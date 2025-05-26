// routes/pagos/returnPayment.js - NUEVO: Manejar retorno de WebPay
const express = require("express");
const db = require("../../utils/db");

const router = express.Router();

// POST /api/payments/return - Recibir retorno de WebPay (éxito)
// GET /api/payments/return - Recibir retorno de WebPay (éxito con API v1.1+)
router.post("/return", handleWebPayReturn);
router.get("/return", handleWebPayReturn);

async function handleWebPayReturn(req, res) {
  try {
    console.log("Retorno de WebPay recibido:", {
      method: req.method,
      query: req.query,
      body: req.body,
    });

    // WebPay puede enviar por GET o POST según la versión
    const params = req.method === "GET" ? req.query : req.body;
    const { token_ws, order } = params;

    if (!token_ws) {
      return res.status(400).json({
        success: false,
        message: "Token WebPay no recibido",
        received_params: params,
      });
    }

    // Buscar el pago por token
    const [pagos] = await db.query(
      "SELECT * FROM ferremas_db.pagos WHERE token_webpay = ?",
      [token_ws]
    );

    if (pagos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pago no encontrado con el token proporcionado",
        token: token_ws,
      });
    }

    const pago = pagos[0];

    // Actualizar estado a "procesando" (esperando confirmación)
    await db.query(
      `
      UPDATE ferremas_db.pagos 
      SET estado = 'procesando', updated_at = NOW()
      WHERE id = ?
    `,
      [pago.id]
    );

    // Log del retorno
    await db.query(
      `
      INSERT INTO ferremas_db.webpay_log 
      (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
      VALUES (?, 'retorno_webpay', ?, ?, 'RETURN', 'Usuario retornó de WebPay', TRUE)
    `,
      [
        pago.id,
        JSON.stringify({ method: req.method, token_ws, order }),
        JSON.stringify(params),
      ]
    );

    // Respuesta para el frontend
    res.json({
      success: true,
      message: "Retorno de WebPay procesado correctamente",
      data: {
        orden_compra: pago.orden_compra,
        estado: "procesando",
        token_ws: token_ws,
        mensaje: "Pago en proceso de verificación",
        next_step: {
          action: "verify_payment",
          url: "/api/payments/verify",
          description: "Llamar verify para confirmar el estado final del pago",
        },
      },
    });
  } catch (error) {
    console.error("Error al procesar retorno de WebPay:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}

// POST /api/payments/error - Manejar retorno de error de WebPay
// GET /api/payments/error - Manejar retorno de error de WebPay
router.post("/error", handleWebPayError);
router.get("/error", handleWebPayError);

async function handleWebPayError(req, res) {
  try {
    console.log("Error de WebPay recibido:", {
      method: req.method,
      query: req.query,
      body: req.body,
    });

    const params = req.method === "GET" ? req.query : req.body;
    const { TBK_TOKEN, TBK_ORDEN_COMPRA, TBK_ID_SESION } = params;

    // Buscar pago por orden de compra o token
    let pago = null;

    if (TBK_ORDEN_COMPRA) {
      const [pagos] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE orden_compra = ?",
        [TBK_ORDEN_COMPRA]
      );
      pago = pagos[0];
    } else if (TBK_TOKEN) {
      const [pagos] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE token_webpay = ?",
        [TBK_TOKEN]
      );
      pago = pagos[0];
    }

    if (pago) {
      // Actualizar estado como cancelado/rechazado
      await db.query(
        `
        UPDATE ferremas_db.pagos 
        SET estado = 'cancelado', updated_at = NOW()
        WHERE id = ?
      `,
        [pago.id]
      );

      // Log del error
      await db.query(
        `
        INSERT INTO ferremas_db.webpay_log 
        (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
        VALUES (?, 'error_webpay', ?, ?, 'ERROR', 'Pago cancelado o rechazado en WebPay', FALSE)
      `,
        [
          pago.id,
          JSON.stringify({ method: req.method }),
          JSON.stringify(params),
        ]
      );
    }

    res.json({
      success: false,
      message: "Pago cancelado o rechazado en WebPay",
      data: {
        orden_compra: TBK_ORDEN_COMPRA,
        estado: "cancelado",
        motivo: "Usuario canceló el pago o fue rechazado por WebPay",
        tbk_token: TBK_TOKEN,
        session_id: TBK_ID_SESION,
      },
    });
  } catch (error) {
    console.error("Error al procesar error de WebPay:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}

module.exports = router;

// ===============================
