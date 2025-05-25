const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

// GET /api/productos - Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    // Realizar consulta SELECT ALL a la tabla productos
    const [rows] = await db.query('SELECT * FROM ferremas_db.productos');
    
    // Responder con los datos
    res.json({
      success: true,
      message: 'Productos obtenidos correctamente',
      data: rows,
      total: rows.length
    });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;