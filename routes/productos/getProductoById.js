const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Producto obtenido correctamente',
      data: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener producto por ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;