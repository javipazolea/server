const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.post('/batch-update', async (req, res) => {
  try {
    const { actualizaciones, motivo_general } = req.body;
    
    // Validaciones
    if (!actualizaciones || !Array.isArray(actualizaciones) || actualizaciones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de actualizaciones'
      });
    }
    
    if (actualizaciones.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Máximo 100 productos por lote'
      });
    }
    
    // Validar estructura de cada actualización
    for (let i = 0; i < actualizaciones.length; i++) {
      const item = actualizaciones[i];
      if (!item.producto_id || item.unidades === undefined || item.unidades < 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: producto_id y unidades (>=0) son requeridos`,
          item_error: item
        });
      }
    }
    
    const resultados = [];
    const errores = [];
    
    // Procesar cada actualización
    for (const actualizacion of actualizaciones) {
      try {
        const { producto_id, unidades, motivo } = actualizacion;
        
        // Verificar que el producto existe
        const [existing] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [producto_id]);
        
        if (existing.length === 0) {
          errores.push({
            producto_id: producto_id,
            error: 'Producto no encontrado'
          });
          continue;
        }
        
        const stockAnterior = existing[0].unidades;
        
        // Actualizar stock
        await db.query(`
          UPDATE ferremas_db.productos 
          SET unidades = ?, updated_at = NOW()
          WHERE id = ?
        `, [unidades, producto_id]);
        
        // Registrar movimiento
        try {
          await db.query(`
            INSERT INTO ferremas_db.movimientos_inventario 
            (producto_id, stock_anterior, stock_nuevo, tipo_operacion, motivo, created_at)
            VALUES (?, ?, ?, 'BATCH_UPDATE', ?, NOW())
          `, [producto_id, stockAnterior, unidades, motivo || motivo_general || 'Actualización masiva']);
        } catch (logError) {
          // Continuar si no existe tabla de movimientos
        }
        
        resultados.push({
          producto_id: producto_id,
          sku: existing[0].sku,
          descripcion: existing[0].descripcion,
          stock_anterior: stockAnterior,
          stock_nuevo: unidades,
          diferencia: unidades - stockAnterior,
          status: 'ACTUALIZADO'
        });
        
      } catch (itemError) {
        errores.push({
          producto_id: actualizacion.producto_id,
          error: itemError.message
        });
      }
    }
    
    // Estadísticas del procesamiento
    const stats = {
      total_procesados: actualizaciones.length,
      exitosos: resultados.length,
      con_errores: errores.length,
      tasa_exito: ((resultados.length / actualizaciones.length) * 100).toFixed(2) + '%'
    };
    
    const statusCode = errores.length > 0 ? 207 : 200; // 207 Multi-Status si hay errores parciales
    
    res.status(statusCode).json({
      success: errores.length === 0,
      message: `Procesamiento completado: ${resultados.length} exitosos, ${errores.length} errores`,
      data: {
        actualizaciones_exitosas: resultados,
        errores: errores,
        estadisticas: stats
      }
    });

  } catch (error) {
    console.error('Error en actualización masiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;