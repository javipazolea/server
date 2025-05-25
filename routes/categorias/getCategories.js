const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

// GET /api/categories - Obtener categorías con subcategorías y productos
router.get('/', async (req, res) => {
  try {
    const [categorias] = await db.query(`
      SELECT * FROM ferremas_db.categories 
      WHERE parent_id IS NULL 
      ORDER BY name
    `);
    
    const categoriasCompletas = [];
    
    for (const categoria of categorias) {
      const [subcategorias] = await db.query(`
        SELECT * FROM ferremas_db.categories 
        WHERE parent_id = ? 
        ORDER BY name
      `, [categoria.id]);
      
      const subcategoriasCompletas = [];
      
      for (const subcategoria of subcategorias) {
        const [productos] = await db.query(`
          SELECT * FROM ferremas_db.productos 
          WHERE subcategoria = ? 
          ORDER BY descripcion
        `, [subcategoria.name]);
        
        subcategoriasCompletas.push({
          id: subcategoria.id,
          name: subcategoria.name,
          description: subcategoria.description,
          productos: productos
        });
      }
      
      categoriasCompletas.push({
        id: categoria.id,
        name: categoria.name,
        description: categoria.description,
        subcategorias: subcategoriasCompletas
      });
    }
    
    res.json({
      success: true,
      message: 'Categorías obtenidas correctamente',
      data: categoriasCompletas,
      total: categoriasCompletas.length
    });

  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;