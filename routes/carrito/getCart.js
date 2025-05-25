const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'session_id es requerido'
      });
    }
    
    // Buscar o crear carrito para la sesión
    let [carritos] = await db.query('SELECT * FROM ferremas_db.carritos WHERE session_id = ?', [session_id]);
    
    if (carritos.length === 0) {
      // Crear nuevo carrito si no existe
      const [result] = await db.query('INSERT INTO ferremas_db.carritos (session_id) VALUES (?)', [session_id]);
      const [newCarrito] = await db.query('SELECT * FROM ferremas_db.carritos WHERE id = ?', [result.insertId]);
      carritos = newCarrito;
    }
    
    const carrito = carritos[0];
    
    // Obtener items del carrito con información del producto
    const [items] = await db.query(`
      SELECT 
        ci.id,
        ci.cantidad,
        ci.precio_unitario,
        ci.cantidad * ci.precio_unitario as subtotal,
        p.id as producto_id,
        p.sku,
        p.descripcion,
        p.categoria,
        p.subcategoria,
        p.unidades as stock_disponible
      FROM ferremas_db.carrito_items ci
      JOIN ferremas_db.productos p ON ci.producto_id = p.id
      WHERE ci.carrito_id = ?
      ORDER BY ci.created_at DESC
    `, [carrito.id]);
    
    // Calcular totales
    const total_items = items.reduce((sum, item) => sum + item.cantidad, 0);
    const total_precio = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    
    res.json({
      success: true,
      message: 'Carrito obtenido correctamente',
      data: {
        carrito_id: carrito.id,
        session_id: carrito.session_id,
        cliente_id: carrito.cliente_id,
        items: items,
        resumen: {
          total_items: total_items,
          total_precio: total_precio.toFixed(2),
          cantidad_productos: items.length
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;