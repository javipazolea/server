const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la categoría existe y obtener estado actual
    const [existing] = await db.query('SELECT * FROM ferremas_db.categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    const currentStatus = existing[0].activa;
    const newStatus = !currentStatus;
    
    // Actualizar estado
    await db.query(`
      UPDATE ferremas_db.categories 
      SET activa = ?, updated_at = NOW()
      WHERE id = ?
    `, [newStatus, id]);
    
    // Obtener la categoría actualizada
    const [updatedCategory] = await db.query('SELECT * FROM ferremas_db.categories WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: `Categoría ${newStatus ? 'activada' : 'desactivada'} correctamente`,
      data: updatedCategory[0],
      previousStatus: currentStatus,
      newStatus: newStatus
    });

  } catch (error) {
    console.error('Error al cambiar estado de la categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;