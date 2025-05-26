const express = require("express");
const cors = require("cors");
const db = require("./utils/db");

//config server

// Importar rutas de productos
const productosRoutes = require("./routes/productos/getProductos");
const productoByIdRoutes = require("./routes/productos/getProductoById");
const searchProductosRoutes = require("./routes/productos/searchProductos");
const createProductoRoutes = require("./routes/productos/createProducto");
const updateProductoRoutes = require("./routes/productos/updateProducto");
const toggleProductoRoutes = require("./routes/productos/toggleProducto");

// Importar rutas de categorías
const categoriesRoutes = require("./routes/categorias/getCategories");
const createCategoriaRoutes = require("./routes/categorias/createCategoria");
const updateCategoriaRoutes = require("./routes/categorias/updateCategoria");
const toggleCategoriaRoutes = require("./routes/categorias/toggleCategoria");

// Importar rutas del carrito
const cartRoutes = require("./routes/carrito/getCart");
const addItemRoutes = require("./routes/carrito/addItem");
const updateItemRoutes = require("./routes/carrito/updateItem");
const deleteItemRoutes = require("./routes/carrito/deleteItem");

// Importar rutas de inventario
const getInventoryRoutes = require("./routes/inventario/getInventory");
const updateInventoryRoutes = require("./routes/inventario/updateInventory");
const batchInventoryRoutes = require("./routes/inventario/batchInventory");

// Importar rutas de pagos
const createPaymentRoutes = require("./routes/pagos/createPayment");
const getPaymentRoutes = require("./routes/pagos/getPayment");
const returnPaymentRoutes = require("./routes/pagos/returnPayment");
const testPaymentRoutes = require("./routes/pagos/testPayment");
const verifyPaymentRoutes = require("./routes/pagos/verifyPayment");

// Crear app de Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// app.use(morgan);

// Rutas base
app.get("/", (req, res) => {
  res.json({
    message: "API Ferremas funcionando correctamente! 🔨",
    endpoints_principales: {
      crear_pago: "POST /api/payments",
      aprobar_pago_testing: "POST /api/payments/test-approve",
      ver_pago: "GET /api/payments/:id",
      listar_pagos: "GET /api/payments/list",
      debug_pago: "GET /api/payments/debug/:id",
    },
  });
});

// Rutas de productos
app.use("/api/productos", searchProductosRoutes);
app.use("/api/productos", toggleProductoRoutes);
app.use("/api/productos", updateProductoRoutes);
app.use("/api/productos", createProductoRoutes);
app.use("/api/productos", productoByIdRoutes);
app.use("/api/productos", productosRoutes);

// Rutas de categorías
app.use("/api/categories", toggleCategoriaRoutes);
app.use("/api/categories", updateCategoriaRoutes);
app.use("/api/categories", createCategoriaRoutes);
app.use("/api/categories", categoriesRoutes);

// Rutas del carrito
app.use("/api/cart", deleteItemRoutes);
app.use("/api/cart", updateItemRoutes);
app.use("/api/cart", addItemRoutes);
app.use("/api/cart", cartRoutes);

// Rutas de inventario
app.use("/api/inventory", batchInventoryRoutes);
app.use("/api/inventory", updateInventoryRoutes);
app.use("/api/inventory", getInventoryRoutes);

// Rutas de pagos (simplificadas)
app.use("/api/payments", getPaymentRoutes);
app.use("/api/payments", createPaymentRoutes);
app.use("/api/payments", returnPaymentRoutes);
app.use("/api/payments", testPaymentRoutes);
app.use("/api/payments", verifyPaymentRoutes);

// Puerto
const PORT = 3001;

const startServer = async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    console.log("Conexión a la base de datos MySQL exitosa");
    conn.release();

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log("🔨 API Ferremas - Modo Testing Simplificado");
      console.log("📝 Endpoints de pagos disponibles:");
      console.log("   POST /api/payments - Crear pago");
      console.log(
        "   POST /api/payments/test-approve - Aprobar pago (testing)"
      );
      console.log("   GET /api/payments/list - Listar pagos");
    });
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error.message);
    process.exit(1);
  }
};

startServer();
