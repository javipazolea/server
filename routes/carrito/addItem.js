const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.post('/items', async (req, res) => {
  try {
    const { session_id, producto_id, cantidad } = req.body;
    
    // Validaciones
    if (!session_id || !producto_id || !cantidad) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: session_id, producto_id, cantidad'
      });
    }
    
    if (cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }
    
    // Verificar que el producto existe y está activo
    const [productos] = await db.query(
      'SELECT * FROM ferremas_db.productos WHERE id = ? AND activo = TRUE', 
      [producto_id]
    );
    
    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado o inactivo'
      });
    }
    
    const producto = productos[0];
    
    // Verificar stock disponible
    if (producto.unidades < cantidad) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${producto.unidades}`,
        stock_disponible: producto.unidades
      });
    }
    
    // Buscar o crear carrito
    let [carritos] = await db.query('SELECT * FROM ferremas_db.carritos WHERE session_id = ?', [session_id]);
    
    if (carritos.length === 0) {
      const [result] = await db.query('INSERT INTO ferremas_db.carritos (session_id) VALUES (?)', [session_id]);
      const [newCarrito] = await db.query('SELECT * FROM ferremas_db.carritos WHERE id = ?', [result.insertId]);
      carritos = newCarrito;
    }
    
    const carrito = carritos[0];
    
    // Verificar si el producto ya está en el carrito
    const [existingItems] = await db.query(
      'SELECT * FROM ferremas_db.carrito_items WHERE carrito_id = ? AND producto_id = ?',
      [carrito.id, producto_id]
    );
    
    if (existingItems.length > 0) {
      // Actualizar cantidad existente
      const newCantidad = existingItems[0].cantidad + cantidad;
      
      // Verificar stock para la nueva cantidad
      if (producto.unidades < newCantidad) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para la cantidad total (${newCantidad}). Disponible: ${producto.unidades}`,
          cantidad_en_carrito: existingItems[0].cantidad,
          stock_disponible: producto.unidades
        });
      }
      
      await db.query(
        'UPDATE ferremas_db.carrito_items SET cantidad = ?, updated_at = NOW() WHERE id = ?',
        [newCantidad, existingItems[0].id]
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
      `, [existingItems[0].id]);
      
      res.json({
        success: true,
        message: 'Cantidad actualizada en el carrito',
        data: updatedItem[0],
        action: 'updated'
      });
      
    } else {
      // Agregar nuevo item
      const [result] = await db.query(`
        INSERT INTO ferremas_db.carrito_items 
        (carrito_id, producto_id, cantidad, precio_unitario) 
        VALUES (?, ?, ?, ?)
      `, [carrito.id, producto_id, cantidad, producto.precio]);
      
      // Obtener el item creado
      const [newItem] = await db.query(`
        SELECT 
          ci.*,
          p.sku,
          p.descripcion,
          ci.cantidad * ci.precio_unitario as subtotal
        FROM ferremas_db.carrito_items ci
        JOIN ferremas_db.productos p ON ci.producto_id = p.id
        WHERE ci.id = ?
      `, [result.insertId]);
      
      res.status(201).json({
        success: true,
        message: 'Producto agregado al carrito',
        data: newItem[0],
        action: 'added'
      });
    }

  } catch (error) {
    console.error('Error al agregar item al carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;