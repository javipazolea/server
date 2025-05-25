const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.put('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { unidades, motivo, tipo_operacion } = req.body;
    
    // Validaciones
    if (unidades === undefined || unidades < 0) {
      return res.status(400).json({
        success: false,
        message: 'Las unidades deben ser un número mayor o igual a 0'
      });
    }
    
    // Verificar que el producto existe
    const [existing] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [productId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    const stockAnterior = existing[0].unidades;
    
    // Actualizar stock
    await db.query(`
      UPDATE ferremas_db.productos 
      SET unidades = ?, updated_at = NOW()
      WHERE id = ?
    `, [unidades, productId]);
    
    // Obtener el producto actualizado
    const [updatedProduct] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [productId]);
    
    // Registrar el movimiento en un log (tabla simple para ejemplo)
    try {
      await db.query(`
        INSERT INTO ferremas_db.movimientos_inventario 
        (producto_id, stock_anterior, stock_nuevo, tipo_operacion, motivo, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [productId, stockAnterior, unidades, tipo_operacion || 'AJUSTE_MANUAL', motivo || 'Actualización manual']);
    } catch (logError) {
      // Si no existe la tabla de movimientos, continuar sin error
      console.log('Tabla movimientos_inventario no existe, continuando...');
    }
    
    // Determinar tipo de cambio
    let tipoMovimiento = '';
    let diferencia = unidades - stockAnterior;
    
    if (diferencia > 0) {
      tipoMovimiento = 'INCREMENTO';
    } else if (diferencia < 0) {
      tipoMovimiento = 'DECREMENTO';
    } else {
      tipoMovimiento = 'SIN_CAMBIO';
    }
    
    res.json({
      success: true,
      message: 'Inventario actualizado correctamente',
      data: updatedProduct[0],
      movimiento: {
        tipo: tipoMovimiento,
        stock_anterior: stockAnterior,
        stock_nuevo: unidades,
        diferencia: diferencia,
        motivo: motivo || 'Actualización manual'
      }
    });

  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;