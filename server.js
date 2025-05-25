const express = require('express');
const cors = require('cors');
const db = require('./utils/db');

// Importar rutas de productos
const productosRoutes = require('./routes/productos/getProductos');
const productoByIdRoutes = require('./routes/productos/getProductoById');
const searchProductosRoutes = require('./routes/productos/searchProductos');
const createProductoRoutes = require('./routes/productos/createProducto');
const updateProductoRoutes = require('./routes/productos/updateProducto');
const toggleProductoRoutes = require('./routes/productos/toggleProducto');

// Importar rutas de categorías
const categoriesRoutes = require('./routes/categorias/getCategories');
const createCategoriaRoutes = require('./routes/categorias/createCategoria');
const updateCategoriaRoutes = require('./routes/categorias/updateCategoria');
const toggleCategoriaRoutes = require('./routes/categorias/toggleCategoria');

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
app.use('/api/productos', searchProductosRoutes); 
app.use('/api/productos', toggleProductoRoutes);
app.use('/api/productos', updateProductoRoutes);
app.use('/api/productos', createProductoRoutes);
app.use('/api/productos', productoByIdRoutes);
app.use('/api/productos', productosRoutes);

// Rutas de categorías
app.use('/api/categories', toggleCategoriaRoutes);
app.use('/api/categories', updateCategoriaRoutes);
app.use('/api/categories', createCategoriaRoutes);
app.use('/api/categories', categoriesRoutes);

// Puerto
const PORT = 3001;

const startServer = async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    console.log('Conexión a la base de datos MySQL exitosa');
    conn.release();

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error.message);
    process.exit(1);
  }
};

startServer();