const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parent_id } = req.body;
    
    // Verificar que la categoría existe
    const [existing] = await db.query('SELECT * FROM ferremas_db.categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    // Si tiene parent_id, verificar que no sea la misma categoría y que la categoría padre existe
    if (parent_id) {
      if (parent_id === parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: 'Una categoría no puede ser padre de sí misma'
        });
      }
      
      const [parentExists] = await db.query('SELECT id FROM ferremas_db.categories WHERE id = ?', [parent_id]);
      if (parentExists.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La categoría padre no existe'
        });
      }
    }
    
    // Actualizar categoría
    await db.query(`
      UPDATE ferremas_db.categories 
      SET name = ?, description = ?, parent_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, description, parent_id || null, id]);
    
    // Obtener la categoría actualizada
    const [updatedCategory] = await db.query('SELECT * FROM ferremas_db.categories WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Categoría actualizada correctamente',
      data: updatedCategory[0]
    });

  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;