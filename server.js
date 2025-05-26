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

// *** NUEVO: Importar rutas de divisas (versión simplificada) ***
const divisasRoutes = require("./routes/divisas");

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
    version: "2.0.0",
    nuevas_funcionalidades: {
      conversion_divisas: "✅ Sistema de conversión de divisas implementado",
      banco_central:
        "✅ Integración con API oficial del Banco Central de Chile",
    },
    endpoints_principales: {
      // Endpoints existentes
      crear_pago: "POST /api/payments",
      aprobar_pago_testing: "POST /api/payments/test-approve",
      ver_pago: "GET /api/payments/:id",
      listar_pagos: "GET /api/payments/list",
      debug_pago: "GET /api/payments/debug/:id",

      // *** NUEVOS: Endpoints de divisas ***
      tipos_cambio: "GET /api/divisas/rates",
      conversion_monedas: "POST /api/divisas/convert",
      conversion_rapida: "GET /api/divisas/convert/:amount/:from/:to",
      actualizar_tipos: "POST /api/divisas/update-rates",
      estado_servicio: "GET /api/divisas/health",
    },
    monedas_soportadas: {
      CLP: "Peso Chileno (moneda base)",
      USD: "Dólar Estadounidense",
      EUR: "Euro",
      UF: "Unidad de Fomento",
      UTM: "Unidad Tributaria Mensual",
      GBP: "Libra Esterlina (próximamente)",
      JPY: "Yen Japonés (próximamente)",
    },
    fuente_datos: "Banco Central de Chile - API Oficial",
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

// Rutas de pagos (existentes)
app.use("/api/payments", getPaymentRoutes);
app.use("/api/payments", createPaymentRoutes);
app.use("/api/payments", returnPaymentRoutes);
app.use("/api/payments", testPaymentRoutes);
app.use("/api/payments", verifyPaymentRoutes);

// *** NUEVAS: Rutas de divisas ***
app.use("/api/divisas", divisasRoutes);

// Puerto
const PORT = 3001;

const startServer = async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    console.log("✅ Conexión a la base de datos MySQL exitosa");
    conn.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log("🔨 API Ferremas - Versión 2.0.0");
      console.log("");
      console.log("📝 Endpoints disponibles:");

      // Endpoints existentes
      console.log("   🛒 PRODUCTOS:");
      console.log("      GET /api/productos - Listar productos");
      console.log("      POST /api/productos - Crear producto");
      console.log("      GET /api/productos/search - Buscar productos");

      console.log("   🛍️  CARRITO:");
      console.log("      GET /api/cart - Obtener carrito");
      console.log("      POST /api/cart/items - Agregar al carrito");

      console.log("   💳 PAGOS:");
      console.log("      POST /api/payments - Crear pago");
      console.log(
        "      POST /api/payments/test-approve - Aprobar pago (testing)"
      );
      console.log("      GET /api/payments/list - Listar pagos");

      // *** NUEVOS: Endpoints de divisas ***
      console.log("   💱 DIVISAS (NUEVO):");
      console.log("      GET /api/divisas - Información del servicio");
      console.log("      GET /api/divisas/rates - Tipos de cambio actuales");
      console.log(
        "      GET /api/divisas/rates/USD - Tipo específico (ej: USD)"
      );
      console.log("      POST /api/divisas/convert - Convertir entre monedas");
      console.log(
        "      GET /api/divisas/convert/100/USD/CLP - Conversión rápida"
      );
      console.log(
        "      POST /api/divisas/update-rates - Actualizar tipos manualmente"
      );
      console.log("      GET /api/divisas/health - Estado del servicio");
      console.log(
        "      GET /api/divisas/test-connection - Probar conexión BCCH"
      );

      console.log("");
      console.log("🏦 Fuente de datos: Banco Central de Chile");
      console.log("💱 Monedas soportadas: CLP, USD, EUR, UF, UTM");
      console.log("⚡ Actualizaciones automáticas programadas");
      console.log("");
      console.log("🔗 Prueba el servicio:");
      console.log(`   curl http://localhost:${PORT}/api/divisas/rates`);
      console.log(
        `   curl http://localhost:${PORT}/api/divisas/convert/100/USD/CLP -X POST -H "Content-Type: application/json" -d '{"amount":100,"fromCurrency":"USD","toCurrency":"CLP"}'`
      );
    });
  } catch (error) {
    console.error("❌ Error al conectar con la base de datos:", error.message);
    console.log("");
    console.log("💡 Posibles soluciones:");
    console.log("   1. Verificar que MySQL esté ejecutándose");
    console.log("   2. Comprobar credenciales en utils/db.js");
    console.log("   3. Ejecutar el script de creación de tablas de divisas");
    console.log("   4. Verificar que la base de datos 'ferremas_db' exista");
    process.exit(1);
  }
};

startServer();
