const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, descripcion, categoria, subcategoria, precio, unidades } = req.body;
    
    // Verificar que el producto existe
    const [existing] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    // Actualizar producto
    await db.query(`
      UPDATE ferremas_db.productos 
      SET sku = ?, descripcion = ?, categoria = ?, subcategoria = ?, precio = ?, unidades = ?, updated_at = NOW()
      WHERE id = ?
    `, [sku, descripcion, categoria, subcategoria, precio, unidades, id]);
    
    // Obtener el producto actualizado
    const [updatedProduct] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Producto actualizado correctamente',
      data: updatedProduct[0]
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    
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