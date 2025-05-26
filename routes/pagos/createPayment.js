// routes/pagos/createPayment.js - VERSIÓN ACTUALIZADA PARA FLUJO OFICIAL
const express = require("express");
const db = require("../../utils/db");
const { transaction } = require("../../config/webpay.config");

const router = express.Router();

// POST /api/payments - Crear nuevo pago
router.post("/", async (req, res) => {
  try {
    const {
      session_id,
      cliente_id,
      monto,
      metodo_pago,
      email_comprador,
      telefono_comprador,
      descripcion,
      items,
      return_url,
    } = req.body;

    // Validaciones básicas
    if (!session_id || !monto || !metodo_pago || !email_comprador || !items) {
      return res.status(400).json({
        success: false,
        message:
          "Campos requeridos: session_id, monto, metodo_pago, email_comprador, items",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debe incluir al menos un item en la compra",
      });
    }

    // Validar monto positivo
    if (monto <= 0) {
      return res.status(400).json({
        success: false,
        message: "El monto debe ser mayor a 0",
      });
    }

    // Generar orden de compra única
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const orden_compra = `ORD-${timestamp}-${randomNum}`;

    // Verificar que los productos existen y calcular total
    let total_calculado = 0;
    const items_validados = [];

    for (const item of items) {
      const [productos] = await db.query(
        "SELECT * FROM ferremas_db.productos WHERE id = ? AND activo = TRUE",
        [item.producto_id]
      );

      if (productos.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Producto con ID ${item.producto_id} no encontrado o inactivo`,
        });
      }

      const producto = productos[0];

      // Verificar stock
      if (producto.unidades < item.cantidad) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${producto.descripcion}. Disponible: ${producto.unidades}`,
          producto_id: item.producto_id,
        });
      }

      const subtotal = item.cantidad * producto.precio;
      total_calculado += subtotal;

      items_validados.push({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: producto.precio,
        subtotal: subtotal,
      });
    }

    // Verificar que el monto enviado coincide con el calculado
    if (Math.abs(monto - total_calculado) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El monto no coincide con el total de los items",
        monto_enviado: monto,
        monto_calculado: total_calculado,
      });
    }

    // Crear registro de pago
    const [pagoResult] = await db.query(
      `
      INSERT INTO ferremas_db.pagos 
      (orden_compra, cliente_id, session_id, monto, metodo_pago, email_comprador, telefono_comprador, descripcion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        orden_compra,
        cliente_id || null,
        session_id,
        monto,
        metodo_pago,
        email_comprador,
        telefono_comprador,
        descripcion || "",
      ]
    );

    const pago_id = pagoResult.insertId;

    // Insertar items del pago
    for (const item of items_validados) {
      await db.query(
        `
        INSERT INTO ferremas_db.pago_items 
        (pago_id, producto_id, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
      `,
        [pago_id, item.producto_id, item.cantidad, item.precio_unitario]
      );
    }

    let webpay_data = null;

    // Si es pago con WebPay, crear transacción
    if (metodo_pago === "webpay") {
      try {
        // URL de retorno - debe manejar tanto éxito como error
        const baseReturnUrl =
          return_url || "http://localhost:3000/payment/return";
        const returnUrl = `${baseReturnUrl}?order=${orden_compra}`;

        console.log("Creando transacción WebPay:", {
          buy_order: orden_compra,
          session_id: session_id,
          amount: Math.round(monto),
          return_url: returnUrl,
        });

        // Crear transacción en WebPay
        const response = await transaction.create(
          orden_compra, // buy_order
          session_id, // session_id
          Math.round(monto), // amount (debe ser entero)
          returnUrl // return_url
        );

        console.log("Respuesta WebPay:", response);

        // Guardar datos de WebPay
        await db.query(
          `
          UPDATE ferremas_db.pagos 
          SET token_webpay = ?, url_webpay = ?, estado = 'pendiente'
          WHERE id = ?
        `,
          [response.token, response.url, pago_id]
        );

        // Log de la operación
        await db.query(
          `
          INSERT INTO ferremas_db.webpay_log 
          (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
          VALUES (?, 'crear_transaccion', ?, ?, '0', 'Transacción creada exitosamente', TRUE)
        `,
          [
            pago_id,
            JSON.stringify({
              buy_order: orden_compra,
              session_id: session_id,
              amount: monto,
              return_url: returnUrl,
            }),
            JSON.stringify(response),
          ]
        );

        webpay_data = {
          token: response.token,
          url: response.url,
          // Información para el frontend
          form_data: {
            action: response.url,
            method: "POST",
            token_ws: response.token,
          },
        };
      } catch (webpayError) {
        console.error("Error al crear transacción WebPay:", webpayError);

        // Log del error
        await db.query(
          `
          INSERT INTO ferremas_db.webpay_log 
          (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
          VALUES (?, 'crear_transaccion', ?, ?, 'ERROR', ?, FALSE)
        `,
          [
            pago_id,
            JSON.stringify({
              buy_order: orden_compra,
              amount: monto,
            }),
            JSON.stringify({ error: webpayError.message }),
            webpayError.message,
          ]
        );

        // Actualizar estado del pago
        await db.query(
          'UPDATE ferremas_db.pagos SET estado = "error" WHERE id = ?',
          [pago_id]
        );

        return res.status(500).json({
          success: false,
          message: "Error al crear transacción con WebPay",
          error: webpayError.message,
          pago_id: pago_id,
        });
      }
    }

    // Obtener el pago creado con items
    const [pagoCreado] = await db.query(
      "SELECT * FROM ferremas_db.pagos WHERE id = ?",
      [pago_id]
    );

    const [itemsPago] = await db.query(
      `
      SELECT 
        pi.producto_id,
        pi.cantidad,
        pi.precio_unitario,
        pi.subtotal,
        p.descripcion,
        p.sku
      FROM ferremas_db.pago_items pi
      JOIN ferremas_db.productos p ON pi.producto_id = p.id
      WHERE pi.pago_id = ?
    `,
      [pago_id]
    );

    res.status(201).json({
      success: true,
      message: "Pago creado correctamente",
      data: {
        ...pagoCreado[0],
        items: itemsPago,
        webpay: webpay_data,
      },
    });
  } catch (error) {
    console.error("Error al crear pago:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

module.exports = router;

// ===============================
