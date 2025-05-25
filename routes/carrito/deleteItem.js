const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el item existe y obtener información
    const [items] = await db.query(`
      SELECT 
        ci.*,
        p.sku,
        p.descripcion
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
    
    // Eliminar el item
    await db.query('DELETE FROM ferremas_db.carrito_items WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Producto eliminado del carrito',
      data: {
        id: item.id,
        producto_id: item.producto_id,
        sku: item.sku,
        descripcion: item.descripcion,
        cantidad_eliminada: item.cantidad
      }
    });

  } catch (error) {
    console.error('Error al eliminar item del carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;