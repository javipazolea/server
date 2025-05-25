const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { sku, descripcion, categoria, subcategoria, precio, unidades } = req.body;
    
    // Validaciones básicas
    if (!sku || !descripcion || !categoria || !subcategoria || !precio) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: sku, descripcion, categoria, subcategoria, precio'
      });
    }
    
    // Insertar nuevo producto
    const [result] = await db.query(`
      INSERT INTO ferremas_db.productos 
      (sku, descripcion, categoria, subcategoria, precio, unidades, activo) 
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `, [sku, descripcion, categoria, subcategoria, precio, unidades || 0]);
    
    // Obtener el producto creado
    const [newProduct] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Producto creado correctamente',
      data: newProduct[0]
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    
    // Error de SKU duplicado
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'El SKU ya existe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;