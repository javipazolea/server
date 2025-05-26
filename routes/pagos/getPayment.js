const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

// GET /api/payments/:id - Obtener pago por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener pago principal
    const [pagos] = await db.query('SELECT * FROM ferremas_db.pagos WHERE id = ?', [id]);
    
    if (pagos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }
    
    const pago = pagos[0];
    
    // Obtener items del pago con información del producto
    const [itemsPago] = await db.query(`
      SELECT 
        pi.id,
        pi.producto_id,
        pi.cantidad,
        pi.precio_unitario,
        pi.subtotal,
        p.descripcion,
        p.sku,
        p.categoria,
        p.subcategoria
      FROM ferremas_db.pago_items pi
      JOIN ferremas_db.productos p ON pi.producto_id = p.id
      WHERE pi.pago_id = ?
      ORDER BY pi.id
    `, [id]);
    
    // Obtener historial de WebPay
    const [historialWebpay] = await db.query(`
      SELECT 
        id,
        operacion,
        success,
        codigo_respuesta,
        mensaje_respuesta,
        created_at
      FROM ferremas_db.webpay_log
      WHERE pago_id = ?
      ORDER BY created_at DESC
    `, [id]);
    
    // Información adicional del cliente si existe
    let cliente_info = null;
    if (pago.cliente_id) {
      const [clientes] = await db.query(
        'SELECT id, nombre, apellido, email, telefono, rut FROM ferremas_db.clientes WHERE id = ?',
        [pago.cliente_id]
      );
      if (clientes.length > 0) {
        cliente_info = clientes[0];
      }
    }
    
    // Calcular totales y estadísticas
    const total_items = itemsPago.reduce((sum, item) => sum + item.cantidad, 0);
    const total_calculado = itemsPago.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    
    // Información de estado del pago
    const estado_info = {
      estado_actual: pago.estado,
      requiere_accion: pago.estado === 'pendiente' || pago.estado === 'procesando',
      es_webpay: pago.metodo_pago === 'webpay',
      tiene_token: !!pago.token_webpay,
      fecha_creacion: pago.created_at,
      ultima_actualizacion: pago.updated_at
    };
    
    // Respuesta completa
    res.json({
      success: true,
      message: 'Pago obtenido correctamente',
      data: {
        // Información principal del pago
        id: pago.id,
        orden_compra: pago.orden_compra,
        cliente_id: pago.cliente_id,
        session_id: pago.session_id,
        monto: parseFloat(pago.monto),
        moneda: pago.moneda,
        metodo_pago: pago.metodo_pago,
        estado: pago.estado,
        
        // Información del comprador
        email_comprador: pago.email_comprador,
        telefono_comprador: pago.telefono_comprador,
        descripcion: pago.descripcion,
        
        // Información de WebPay (si aplica)
        webpay_info: pago.metodo_pago === 'webpay' ? {
          token_webpay: pago.token_webpay,
          url_webpay: pago.url_webpay,
          transaction_date: pago.transaction_date,
          authorization_code: pago.authorization_code,
          payment_type_code: pago.payment_type_code,
          response_code: pago.response_code,
          installments_number: pago.installments_number
        } : null,
        
        // Items del pago
        items: itemsPago,
        
        // Resumen del pago
        resumen: {
          total_items: total_items,
          cantidad_productos: itemsPago.length,
          total_calculado: total_calculado.toFixed(2),
          diferencia_monto: (parseFloat(pago.monto) - total_calculado).toFixed(2)
        },
        
        // Información del cliente
        cliente_info: cliente_info,
        
        // Estado e información adicional
        estado_info: estado_info,
        
        // Historial de operaciones WebPay
        historial_webpay: historialWebpay,
        
        // Metadatos
        datos_adicionales: pago.datos_adicionales ? JSON.parse(pago.datos_adicionales) : null,
        created_at: pago.created_at,
        updated_at: pago.updated_at
      }
    });

  } catch (error) {
    console.error('Error al obtener pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;