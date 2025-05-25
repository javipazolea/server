const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Parámetro de búsqueda requerido'
      });
    }
    
    const searchTerm = `%${q}%`;
    
    const [rows] = await db.query(`
      SELECT * FROM ferremas_db.productos 
      WHERE descripcion LIKE ? 
         OR categoria LIKE ? 
         OR subcategoria LIKE ? 
         OR sku LIKE ?
      ORDER BY descripcion
    `, [searchTerm, searchTerm, searchTerm, searchTerm]);
    
    res.json({
      success: true,
      message: `Se encontraron ${rows.length} productos`,
      data: rows,
      total: rows.length,
      searchTerm: q
    });

  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;