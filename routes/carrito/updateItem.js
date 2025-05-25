const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    // Validaciones
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }
    
    // Verificar que el item existe
    const [items] = await db.query(`
      SELECT 
        ci.*,
        p.unidades as stock_disponible,
        p.descripcion,
        p.sku
      FROM ferremas_db.carrito_items ci
      JOIN ferremas_db.productos p ON ci.producto_id = p.id
      WHERE ci.id = ?
    `, [id]);
    
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item del carrito no encontrado'
      });
    }
    
    const item = items[0];
    
    // Verificar stock disponible
    if (item.stock_disponible < cantidad) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${item.stock_disponible}`,
        stock_disponible: item.stock_disponible
      });
    }
    
    // Actualizar cantidad
    await db.query(
      'UPDATE ferremas_db.carrito_items SET cantidad = ?, updated_at = NOW() WHERE id = ?',
      [cantidad, id]
    );
    
    // Obtener el item actualizado
    const [updatedItem] = await db.query(`
      SELECT 
        ci.*,
        p.sku,
        p.descripcion,
        ci.cantidad * ci.precio_unitario as subtotal
      FROM ferremas_db.carrito_items ci
      JOIN ferremas_db.productos p ON ci.producto_id = p.id
      WHERE ci.id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Cantidad actualizada correctamente',
      data: updatedItem[0]
    });

  } catch (error) {
    console.error('Error al actualizar item del carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
