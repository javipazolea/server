// routes/pagos/testPayment.js - VERSIÓN SIMPLIFICADA SIN VERIFY
const express = require("express");
const db = require("../../utils/db");

const router = express.Router();

// Función auxiliar para convertir fechas al formato MySQL
function convertirFechaParaMySQL(fecha) {
  try {
    if (!fecha) {
      return new Date().toISOString().slice(0, 19).replace("T", " ");
    }

    // Si ya es un objeto Date
    if (fecha instanceof Date) {
      return fecha.toISOString().slice(0, 19).replace("T", " ");
    }

    // Si es string, convertir a Date primero
    if (typeof fecha === "string") {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) {
        console.warn("Fecha inválida recibida:", fecha);
        return new Date().toISOString().slice(0, 19).replace("T", " ");
      }
      return fechaObj.toISOString().slice(0, 19).replace("T", " ");
    }

    // Fallback a fecha actual
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  } catch (error) {
    console.error("Error al convertir fecha:", error);
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }
}

// POST /api/payments/test-approve - Simular aprobación de pago para testing
router.post("/test-approve", async (req, res) => {
  try {
    const { pago_id, orden_compra } = req.body;

    // Buscar pago por ID o por orden de compra
    let pago;
    if (pago_id) {
      const [pagos] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE id = ?",
        [pago_id]
      );
      pago = pagos[0];
    } else if (orden_compra) {
      const [pagos] = await db.query(
        "SELECT * FROM ferremas_db.pagos WHERE orden_compra = ?",
        [orden_compra]
      );
      pago = pagos[0];
    } else {
      return res.status(400).json({
        success: false,
        message: "Debe proporcionar pago_id o orden_compra",
      });
    }

    if (!pago) {
      return res.status(404).json({
        success: false,
        message: "Pago no encontrado",
      });
    }

    // Verificar si el pago ya fue procesado
    if (pago.estado === "aprobado") {
      return res.json({
        success: true,
        message: "Pago ya fue aprobado previamente",
        data: {
          orden_compra: pago.orden_compra,
          estado: pago.estado,
          authorization_code: pago.authorization_code,
          ya_procesado: true,
        },
      });
    }

    // Simular respuesta exitosa de WebPay
    const fake_authorization = `TEST${Date.now()}`;
    const fake_transaction_date = convertirFechaParaMySQL(new Date());

    console.log("Fecha convertida para MySQL:", fake_transaction_date);

    // Actualizar pago como aprobado
    await db.query(
      `
      UPDATE ferremas_db.pagos 
      SET 
        estado = 'aprobado',
        transaction_date = ?,
        authorization_code = ?,
        response_code = 0,
        payment_type_code = 'VD',
        installments_number = 1,
        updated_at = NOW()
      WHERE id = ?
    `,
      [fake_transaction_date, fake_authorization, pago.id]
    );

    // Log de testing
    await db.query(
      `
      INSERT INTO ferremas_db.webpay_log 
      (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        pago.id,
        "test_approval", // Operación corta
        JSON.stringify({ test_mode: true, pago_id: pago.id }),
        JSON.stringify({
          authorization_code: fake_authorization,
          response_code: 0,
          transaction_date: fake_transaction_date,
          test_mode: true,
        }).substring(0, 1000), // Limitar tamaño
        "0",
        "Pago de prueba aprobado exitosamente",
        true,
      ]
    );

    // Actualizar inventario (reducir stock)
    const [items] = await db.query(
      "SELECT * FROM ferremas_db.pago_items WHERE pago_id = ?",
      [pago.id]
    );

    for (const item of items) {
      // Obtener stock actual
      const [stockActual] = await db.query(
        "SELECT unidades FROM ferremas_db.productos WHERE id = ?",
        [item.producto_id]
      );

      if (stockActual.length > 0) {
        const stockAnterior = stockActual[0].unidades;
        const stockNuevo = Math.max(0, stockAnterior - item.cantidad); // No permitir stock negativo

        // Actualizar stock
        await db.query(
          "UPDATE ferremas_db.productos SET unidades = ? WHERE id = ?",
          [stockNuevo, item.producto_id]
        );

        // Registrar movimiento
        await db.query(
          `
          INSERT INTO ferremas_db.movimientos_inventario 
          (producto_id, stock_anterior, stock_nuevo, tipo_operacion, motivo)
          VALUES (?, ?, ?, 'VENTA', ?)
        `,
          [
            item.producto_id,
            stockAnterior,
            stockNuevo,
            `Venta TEST - Orden ${pago.orden_compra}`,
          ]
        );
      }
    }

    // Obtener pago actualizado con items
    const [pagoActualizado] = await db.query(
      "SELECT * FROM ferremas_db.pagos WHERE id = ?",
      [pago.id]
    );

    const [itemsActualizados] = await db.query(
      `
      SELECT 
        pi.*,
        p.descripcion,
        p.sku,
        p.unidades as stock_actual
      FROM ferremas_db.pago_items pi
      JOIN ferremas_db.productos p ON pi.producto_id = p.id
      WHERE pi.pago_id = ?
    `,
      [pago.id]
    );

    res.json({
      success: true,
      message: "Pago de prueba aprobado exitosamente",
      data: {
        ...pagoActualizado[0],
        items: itemsActualizados,
        test_mode: true,
        authorization_code: fake_authorization,
        note: "✅ Pago aprobado automáticamente - Modo Testing Ferremas",
      },
    });
  } catch (error) {
    console.error("Error en pago de prueba:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/payments/debug/:id - Debug completo de un pago
router.get("/debug/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener toda la información del pago
    const [pagos] = await db.query(
      "SELECT * FROM ferremas_db.pagos WHERE id = ?",
      [id]
    );

    if (pagos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pago no encontrado",
      });
    }

    const pago = pagos[0];

    // Obtener items
    const [items] = await db.query(
      `
      SELECT 
        pi.*,
        p.descripcion,
        p.sku,
        p.unidades as stock_actual
      FROM ferremas_db.pago_items pi
      JOIN ferremas_db.productos p ON pi.producto_id = p.id
      WHERE pi.pago_id = ?
    `,
      [id]
    );

    // Obtener logs de WebPay
    const [logs] = await db.query(
      `
      SELECT * FROM ferremas_db.webpay_log 
      WHERE pago_id = ? 
      ORDER BY created_at DESC
    `,
      [id]
    );

    // Obtener movimientos de inventario relacionados
    const [movimientos] = await db.query(
      `
      SELECT 
        mi.*,
        p.sku,
        p.descripcion
      FROM ferremas_db.movimientos_inventario mi
      JOIN ferremas_db.productos p ON mi.producto_id = p.id
      WHERE mi.motivo LIKE ?
      ORDER BY mi.created_at DESC
    `,
      [`%${pago.orden_compra}%`]
    );

    // Análisis del pago
    const analisis = {
      estado_actual: pago.estado,
      metodo_pago: pago.metodo_pago,
      monto_original: pago.monto,
      cantidad_items: items.length,
      total_calculado: items.reduce(
        (sum, item) => sum + parseFloat(item.subtotal),
        0
      ),
      operaciones_realizadas: logs.length,
      movimientos_inventario: movimientos.length,
      fecha_creacion: pago.created_at,
      ultima_actualizacion: pago.updated_at,
    };

    // Recomendaciones simplificadas
    const recomendaciones = [];

    if (pago.estado === "pendiente") {
      recomendaciones.push(
        "💡 Usa POST /api/payments/test-approve para aprobar este pago"
      );
    }

    if (pago.estado === "aprobado" && movimientos.length === 0) {
      recomendaciones.push(
        "⚠️ Pago aprobado pero sin movimientos de inventario - revisar"
      );
    }

    if (pago.estado === "aprobado") {
      recomendaciones.push("✅ Pago completado exitosamente");
    }

    res.json({
      success: true,
      message: "Debug completo del pago",
      data: {
        pago_info: pago,
        items: items,
        analisis: analisis,
        logs_operaciones: logs,
        movimientos_inventario: movimientos,
        recomendaciones: recomendaciones,
        comandos_utiles: {
          aprobar_pago: `POST /api/payments/test-approve con {"pago_id": ${id}}`,
          ver_pago: `GET /api/payments/${id}`,
          listar_pagos: "GET /api/payments/list",
        },
      },
    });
  } catch (error) {
    console.error("Error en debug:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

// GET /api/payments/list - Listar todos los pagos para debug
router.get("/list", async (req, res) => {
  try {
    const [pagos] = await db.query(`
      SELECT 
        p.*,
        COUNT(pi.id) as cantidad_items,
        SUM(pi.subtotal) as total_items
      FROM ferremas_db.pagos p
      LEFT JOIN ferremas_db.pago_items pi ON p.id = pi.pago_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      message: "Lista de pagos para debug",
      data: pagos.map((pago) => ({
        id: pago.id,
        orden_compra: pago.orden_compra,
        estado: pago.estado,
        metodo_pago: pago.metodo_pago,
        monto: pago.monto,
        cantidad_items: pago.cantidad_items,
        created_at: pago.created_at,
        debug_url: `/api/payments/debug/${pago.id}`,
        test_approve_cmd: `POST /api/payments/test-approve {"pago_id": ${pago.id}}`,
      })),
    });
  } catch (error) {
    console.error("Error al listar pagos:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

module.exports = router;
