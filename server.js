// server.js
const express = require('express');
const cors = require('cors');
const db = require('./utils/db')

// Crear app de Express
const app = express();

// Middleware
app.use(cors());                         // Permitir CORS
app.use(express.json());                 // Parsear JSON

// Rutas base
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando correctamente 🚀' });
});


// Puerto
const PORT =  3001

const startServer = async () => {
    try {
      const conn = await db.getConnection();
      await conn.ping(); // Verifica si la conexión responde
      console.log('✅ Conexión a la base de datos MySQL exitosa');
      conn.release();
  
      app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('❌ Error al conectar con la base de datos:', error.message);
      process.exit(1); // Termina el proceso si falla la conexión
    }
  };
  
  startServer();