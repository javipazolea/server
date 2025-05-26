const express = require("express");
const db = require("../../utils/db");
const { transaction } = require("../../config/webpay.config");

const router = express.Router();

// Cache en memoria para evitar procesamiento duplicado del mismo token
const processingTokens = new Set();

// POST /api/payments/verify - Verificar transacción después del retorno
router.post("/verify", async (req, res) => {
  try {
    const { token_ws, orden_compra } = req.body;

    if (!token_ws) {
      return res.status(400).json({
        success: false,
        message: "Token WebPay es requerido",
      });
    }

    console.log(`🔍 VERIFY REQUEST - Token: ${token_ws.substring(0, 10)}...`);

    // PROTECCIÓN CONTRA DUPLICADOS: Verificar si el token ya está siendo procesado
    if (processingTokens.has(token_ws)) {
      console.log(
        `⚠️ TOKEN YA EN PROCESAMIENTO: ${token_ws.substring(0, 10)}...`
      );
      return res.status(429).json({
        success: false,
        message: "Token ya está siendo procesado, espere un momento",
      });
    }

    // Marcar token como en procesamiento
    processingTokens.add(token_ws);

    try {
      // Buscar el pago por token
      const [pagos] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE token_webpay = ?",
        [token_ws]
      );

      if (pagos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pago no encontrado con el token proporcionado",
        });
      }

      const pago = pagos[0];
      console.log(
        `📋 PAGO ENCONTRADO - ID: ${pago.id}, Estado: ${pago.estado}`
      );

      // CASO 1: Si el pago ya fue aprobado, retornar éxito inmediatamente
      if (pago.estado === "aprobado") {
        console.log(`✅ PAGO YA APROBADO - Retornando datos existentes`);
        return res.json({
          success: true,
          message: "Pago ya fue verificado y aprobado previamente",
          data: {
            ...pago,
            ya_procesado: true,
          },
        });
      }

      // CASO 2: Si el pago ya fue rechazado/cancelado, retornar estado actual
      if (
        pago.estado === "rechazado" ||
        pago.estado === "cancelado" ||
        pago.estado === "error"
      ) {
        console.log(`❌ PAGO YA PROCESADO CON ERROR - Estado: ${pago.estado}`);
        return res.status(400).json({
          success: false,
          message: `Pago ya fue procesado con estado: ${pago.estado}`,
          data: {
            ...pago,
            ya_procesado: true,
          },
        });
      }

      // CASO 3: Pago pendiente/procesando - Intentar confirmar con WebPay
      console.log(
        `🔄 CONFIRMANDO CON WEBPAY - Token: ${token_ws.substring(0, 10)}...`
      );

      let webpayResponse = null;
      let verificacionExitosa = false;
      let mensajeResultado = "";
      let nuevoEstado = "error";

      try {
        // PASO CRÍTICO: Confirmar la transacción con WebPay
        webpayResponse = await transaction.commit(token_ws);
        console.log("✅ RESPUESTA WEBPAY COMMIT:", {
          status: webpayResponse.status,
          response_code: webpayResponse.response_code,
          authorization_code: webpayResponse.authorization_code,
        });

        // Verificar si la transacción fue aprobada
        verificacionExitosa =
          webpayResponse.response_code === 0 &&
          webpayResponse.status === "AUTHORIZED";

        nuevoEstado = verificacionExitosa ? "aprobado" : "rechazado";
        mensajeResultado = verificacionExitosa
          ? "Pago verificado y aprobado exitosamente"
          : `Pago rechazado - Código: ${webpayResponse.response_code}`;
      } catch (webpayError) {
        console.error("❌ ERROR WEBPAY COMMIT:", webpayError.message);

        const errorMessage = webpayError.message || "";

        if (errorMessage.includes("aborted")) {
          nuevoEstado = "cancelado";
          mensajeResultado = "Pago cancelado por el usuario";
        } else if (errorMessage.includes("invalid finished state")) {
          nuevoEstado = "cancelado";
          mensajeResultado = "Transacción no completada en WebPay";
        } else if (errorMessage.includes("timeout")) {
          nuevoEstado = "expirado";
          mensajeResultado = "Transacción expirada";
        } else {
          nuevoEstado = "error";
          mensajeResultado = "Error al verificar pago con WebPay";
        }

        console.log(
          `📝 ESTADO DETERMINADO: ${nuevoEstado} - ${mensajeResultado}`
        );
      }

      // Actualizar el pago en la base de datos
      try {
        if (webpayResponse && verificacionExitosa) {
          console.log("💾 ACTUALIZANDO BD - PAGO EXITOSO");

          const transactionDate = convertirFechaParaMySQL(
            webpayResponse.transaction_date
          );

          await db.query(
            `UPDATE ferremas_db.pagos 
             SET estado = ?, transaction_date = ?, authorization_code = ?, 
                 payment_type_code = ?, response_code = ?, installments_number = ?, 
                 updated_at = NOW()
             WHERE id = ?`,
            [
              nuevoEstado,
              transactionDate,
              webpayResponse.authorization_code || null,
              webpayResponse.payment_type_code || null,
              webpayResponse.response_code || null,
              webpayResponse.installments_number || 1,
              pago.id,
            ]
          );

          // Actualizar inventario si el pago fue exitoso
          await actualizarInventario(pago, webpayResponse.authorization_code);
          console.log("📦 INVENTARIO ACTUALIZADO");
        } else {
          console.log("💾 ACTUALIZANDO BD - PAGO FALLIDO");
          await db.query(
            "UPDATE ferremas_db.pagos SET estado = ?, updated_at = NOW() WHERE id = ?",
            [nuevoEstado, pago.id]
          );
        }

        console.log(`✅ PAGO ${pago.id} ACTUALIZADO A: ${nuevoEstado}`);
      } catch (dbError) {
        console.error("❌ ERROR AL ACTUALIZAR BD:", dbError);
        // Continuar con el proceso
      }

      // Registrar log de la operación
      try {
        await db.query(
          `INSERT INTO ferremas_db.webpay_log 
           (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pago.id,
            "verify_payment",
            JSON.stringify({ token: token_ws }),
            JSON.stringify(
              webpayResponse || { error: mensajeResultado }
            ).substring(0, 1000),
            webpayResponse?.response_code?.toString() || "ERROR",
            mensajeResultado.substring(0, 255),
            verificacionExitosa,
          ]
        );
      } catch (logError) {
        console.error("⚠️ ERROR AL REGISTRAR LOG:", logError);
      }

      // Obtener el pago actualizado para la respuesta
      const [pagoActualizado] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE id = ?",
        [pago.id]
      );

      // Construir respuesta final
      const respuesta = {
        success: verificacionExitosa,
        message: mensajeResultado,
        data: {
          ...pagoActualizado[0],
          webpay_response: webpayResponse || null,
        },
      };

      const statusCode = verificacionExitosa ? 200 : 400;
      console.log(`📤 RESPUESTA FINAL: ${statusCode} - ${mensajeResultado}`);

      res.status(statusCode).json(respuesta);
    } finally {
      // CRÍTICO: Liberar el token del cache después del procesamiento
      setTimeout(() => {
        processingTokens.delete(token_ws);
        console.log(`🧹 TOKEN LIBERADO: ${token_ws.substring(0, 10)}...`);
      }, 2000); // Esperar 2 segundos antes de liberar
    }
  } catch (error) {
    console.error("❌ ERROR GENERAL EN VERIFY:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// Función auxiliar para convertir fechas al formato MySQL
function convertirFechaParaMySQL(fecha) {
  try {
    if (!fecha) {
      return new Date().toISOString().slice(0, 19).replace("T", " ");
    }
    if (fecha instanceof Date) {
      return fecha.toISOString().slice(0, 19).replace("T", " ");
    }
    if (typeof fecha === "string") {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) {
        return new Date().toISOString().slice(0, 19).replace("T", " ");
      }
      return fechaObj.toISOString().slice(0, 19).replace("T", " ");
    }
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  } catch (error) {
    console.error("Error al convertir fecha:", error);
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }
}

// Función auxiliar para actualizar inventario
async function actualizarInventario(pago, authorizationCode) {
  const [items] = await db.query(
    "SELECT * FROM ferremas_db.pago_items WHERE pago_id = ?",
    [pago.id]
  );

  for (const item of items) {
    const [stockActual] = await db.query(
      "SELECT unidades FROM ferremas_db.productos WHERE id = ?",
      [item.producto_id]
    );

    if (stockActual.length > 0) {
      const stockAnterior = stockActual[0].unidades;
      const stockNuevo = Math.max(0, stockAnterior - item.cantidad);

      await db.query(
        "UPDATE ferremas_db.productos SET unidades = ? WHERE id = ?",
        [stockNuevo, item.producto_id]
      );

      await db.query(
        `INSERT INTO ferremas_db.movimientos_inventario 
         (producto_id, stock_anterior, stock_nuevo, tipo_operacion, motivo)
         VALUES (?, ?, ?, 'VENTA', ?)`,
        [
          item.producto_id,
          stockAnterior,
          stockNuevo,
          `Venta WebPay - Orden ${pago.orden_compra} - Auth: ${authorizationCode}`,
        ]
      );
    }
  }
}

module.exports = router;
