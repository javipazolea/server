const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Obtener información del producto e inventario
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.sku,
        p.descripcion,
        p.categoria,
        p.subcategoria,
        p.precio,
        p.unidades as stock_actual,
        p.activo,
        p.created_at,
        p.updated_at,
        -- Calcular estadísticas adicionales
        CASE 
          WHEN p.unidades <= 5 THEN 'BAJO'
          WHEN p.unidades <= 20 THEN 'MEDIO'
          ELSE 'ALTO'
        END as nivel_stock,
        -- Simular stock mínimo recomendado basado en categoría
        CASE 
          WHEN p.categoria = 'Tornillos y Anclajes' THEN 100
          WHEN p.categoria = 'Materiales de Construcción' THEN 50
          WHEN p.categoria = 'Herramientas Eléctricas' THEN 10
          ELSE 20
        END as stock_minimo_recomendado
      FROM ferremas_db.productos p
      WHERE p.id = ?
    `, [productId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const producto = rows[0];
    
    // Obtener historial de movimientos recientes (simulado con updates)
    const [movimientos] = await db.query(`
      SELECT 
        'AJUSTE_MANUAL' as tipo_movimiento,
        p.unidades as cantidad_actual,
        p.updated_at as fecha_movimiento,
        'Sistema' as usuario
      FROM ferremas_db.productos p
      WHERE p.id = ?
      ORDER BY p.updated_at DESC
      LIMIT 5
    `, [productId]);
    
    // Calcular alertas
    const alertas = [];
    if (producto.stock_actual <= producto.stock_minimo_recomendado) {
      alertas.push({
        tipo: 'STOCK_BAJO',
        mensaje: `Stock por debajo del mínimo recomendado (${producto.stock_minimo_recomendado})`,
        prioridad: 'ALTA'
      });
    }
    
    if (producto.stock_actual === 0) {
      alertas.push({
        tipo: 'SIN_STOCK',
        mensaje: 'Producto sin stock disponible',
        prioridad: 'CRÍTICA'
      });
    }
    
    res.json({
      success: true,
      message: 'Inventario obtenido correctamente',
      data: {
        producto: producto,
        movimientos_recientes: movimientos,
        alertas: alertas,
        recomendaciones: {
          restock_sugerido: producto.stock_actual <= producto.stock_minimo_recomendado,
          cantidad_sugerida: producto.stock_minimo_recomendado * 2
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;