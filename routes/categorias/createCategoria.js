const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, description, parent_id } = req.body;
    
    // Validaciones básicas
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }
    
    // Si tiene parent_id, verificar que la categoría padre existe
    if (parent_id) {
      const [parentExists] = await db.query('SELECT id FROM ferremas_db.categories WHERE id = ?', [parent_id]);
      if (parentExists.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La categoría padre no existe'
        });
      }
    }
    
    // Insertar nueva categoría
    const [result] = await db.query(`
      INSERT INTO ferremas_db.categories 
      (name, description, parent_id, activa) 
      VALUES (?, ?, ?, TRUE)
    `, [name, description, parent_id || null]);
    
    // Obtener la categoría creada
    const [newCategory] = await db.query('SELECT * FROM ferremas_db.categories WHERE id = ?', [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Categoría creada correctamente',
      data: newCategory[0]
    });

  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;