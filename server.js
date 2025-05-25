const express = require('express');
const cors = require('cors');
const db = require('./utils/db');

// Importar rutas
const productosRoutes = require('./routes/productos/getProductos');

// Crear app de Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas base
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando correctamente 🚀' });
});

// Rutas de productos
app.use('/api/productos', productosRoutes);

// Puerto
const PORT = 3001;

const startServer = async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    console.log('✅ Conexión a la base de datos MySQL exitosa');
    conn.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    process.exit(1);
  }
};

startServer();