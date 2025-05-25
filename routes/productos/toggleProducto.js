const express = require('express');
const db = require('../../utils/db');

const router = express.Router();

router.patch('/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el producto existe y obtener estado actual
      const [existing] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      const currentStatus = existing[0].activo;
      const newStatus = !currentStatus;
      
      // Actualizar estado
      await db.query(`
        UPDATE ferremas_db.productos 
        SET activo = ?, updated_at = NOW()
        WHERE id = ?
      `, [newStatus, id]);
      
      // Obtener el producto actualizado
      const [updatedProduct] = await db.query('SELECT * FROM ferremas_db.productos WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: `Producto ${newStatus ? 'activado' : 'desactivado'} correctamente`,
        data: updatedProduct[0],
        previousStatus: currentStatus,
        newStatus: newStatus
      });
  
    } catch (error) {
      console.error('Error al cambiar estado del producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  });
  
  module.exports = router;