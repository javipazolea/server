-- =====================================================
-- SCRIPT DE CREACIÓN BASE DE DATOS FERREMAS
-- Versión corregida y organizada
-- =====================================================

-- 1. CREAR Y USAR BASE DE DATOS
-- =====================================================
CREATE DATABASE IF NOT EXISTS ferremas_db;
USE ferremas_db;

-- Configuraciones iniciales
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- 2. CREAR TABLAS PRINCIPALES
-- =====================================================

-- TABLA CATEGORÍAS (debe ir primero por las referencias)
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id INT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent_id (parent_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar foreign key después de crear la tabla
ALTER TABLE categories 
ADD CONSTRAINT fk_categories_parent 
FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE;

-- TABLA PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(20) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  unidades INT NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sku (sku),
  INDEX idx_categoria (categoria),
  INDEX idx_subcategoria (subcategoria),
  INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol ENUM('administrador', 'vendedor', 'bodeguero', 'contador') NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rut VARCHAR(12) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  direccion VARCHAR(255),
  ciudad VARCHAR(50),
  region VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rut (rut),
  INDEX idx_email (email),
  INDEX idx_nombre (nombre, apellido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA SUCURSALES
CREATE TABLE IF NOT EXISTS sucursales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  comuna VARCHAR(50) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(100),
  horario_atencion VARCHAR(100),
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comuna (comuna),
  INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA CARRITOS
CREATE TABLE IF NOT EXISTS carritos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  cliente_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_cliente_id (cliente_id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA CARRITO ITEMS
CREATE TABLE IF NOT EXISTS carrito_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  carrito_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_carrito_id (carrito_id),
  INDEX idx_producto_id (producto_id),
  FOREIGN KEY (carrito_id) REFERENCES carritos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  UNIQUE KEY unique_carrito_producto (carrito_id, producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA MOVIMIENTOS DE INVENTARIO
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  stock_anterior INT NOT NULL,
  stock_nuevo INT NOT NULL,
  diferencia INT AS (stock_nuevo - stock_anterior) STORED,
  tipo_operacion ENUM('AJUSTE_MANUAL', 'RESTOCK', 'VENTA', 'MERMA', 'BATCH_UPDATE', 'DEVOLUCION') NOT NULL,
  motivo TEXT,
  usuario_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_producto_id (producto_id),
  INDEX idx_tipo_operacion (tipo_operacion),
  INDEX idx_fecha (created_at),
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLAS SISTEMA DE PAGOS
-- =====================================================

-- TABLA PRINCIPAL DE PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_compra VARCHAR(50) NOT NULL UNIQUE,
  cliente_id INT NULL,
  session_id VARCHAR(255) NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'CLP',
  metodo_pago ENUM('webpay', 'transferencia', 'efectivo') NOT NULL,
  estado ENUM('pendiente', 'procesando', 'aprobado', 'rechazado', 'cancelado', 'expirado', 'error', 'anulado') DEFAULT 'pendiente',
  -- Campos específicos de WebPay
  token_webpay VARCHAR(255) NULL,
  url_webpay TEXT NULL,
  transaction_date DATETIME NULL,
  authorization_code VARCHAR(50) NULL,
  payment_type_code VARCHAR(10) NULL,
  response_code INT NULL,
  installments_number INT DEFAULT 1,
  -- Datos del comprador
  email_comprador VARCHAR(100),
  telefono_comprador VARCHAR(20),
  -- Metadatos
  descripcion TEXT,
  datos_adicionales JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Índices
  INDEX idx_orden_compra (orden_compra),
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_session_id (session_id),
  INDEX idx_estado (estado),
  INDEX idx_token_webpay (token_webpay),
  INDEX idx_fecha_transaccion (transaction_date),
  -- Relaciones
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA DE ITEMS DEL PAGO
CREATE TABLE IF NOT EXISTS pago_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pago_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Índices
  INDEX idx_pago_id (pago_id),
  INDEX idx_producto_id (producto_id),
  -- Relaciones
  FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA DE LOG DE TRANSACCIONES WEBPAY
CREATE TABLE IF NOT EXISTS webpay_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pago_id INT NOT NULL,
  operacion VARCHAR(50) NOT NULL,
  request_data TEXT,
  response_data TEXT,
  codigo_respuesta VARCHAR(10),
  mensaje_respuesta VARCHAR(500),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Índices
  INDEX idx_pago_id (pago_id),
  INDEX idx_operacion (operacion),
  INDEX idx_success (success),
  -- Relaciones
  FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLAS SISTEMA DE DIVISAS
-- =====================================================

-- TABLA CURRENCY_RATES - Caché de tipos de cambio
CREATE TABLE IF NOT EXISTS currency_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(15, 6) NOT NULL,
  rate_date DATE NOT NULL,
  source ENUM('BCCH_API', 'MANUAL', 'CACHE') DEFAULT 'BCCH_API',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices para optimizar consultas
  INDEX idx_currency_date (currency, rate_date),
  INDEX idx_updated_at (updated_at),
  INDEX idx_source (source),
  INDEX idx_currency_rates_lookup (currency, rate_date DESC, updated_at DESC),
  
  -- Clave única para evitar duplicados
  UNIQUE KEY unique_currency_date (currency, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Caché de tipos de cambio obtenidos de la API del Banco Central';

-- TABLA CURRENCY_CONVERSIONS - Registro de conversiones realizadas
CREATE TABLE IF NOT EXISTS currency_conversions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DECIMAL(15, 6) NOT NULL,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  exchange_rate DECIMAL(15, 6) NOT NULL,
  converted_amount DECIMAL(15, 6) NOT NULL,
  conversion_date DATE NOT NULL,
  user_session VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para consultas frecuentes
  INDEX idx_currencies (from_currency, to_currency),
  INDEX idx_conversion_date (conversion_date),
  INDEX idx_created_at (created_at),
  INDEX idx_user_session (user_session),
  INDEX idx_conversions_stats (created_at, from_currency, to_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro histórico de todas las conversiones realizadas';

-- TABLA CURRENCY_CONFIG - Configuración de monedas soportadas
CREATE TABLE IF NOT EXISTS currency_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  currency_code VARCHAR(10) NOT NULL UNIQUE,
  currency_name VARCHAR(100) NOT NULL,
  currency_symbol VARCHAR(10) DEFAULT '',
  bcch_series_code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  decimal_places INT DEFAULT 2,
  update_frequency ENUM('DAILY', 'HOURLY', 'MANUAL') DEFAULT 'DAILY',
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_currency_code (currency_code),
  INDEX idx_is_active (is_active),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuración de monedas soportadas por el sistema';

-- TABLA CURRENCY_ALERTS - Alertas de cambios significativos
CREATE TABLE IF NOT EXISTS currency_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  previous_rate DECIMAL(15, 6) NOT NULL,
  current_rate DECIMAL(15, 6) NOT NULL,
  change_percentage DECIMAL(8, 4) NOT NULL,
  threshold_percentage DECIMAL(8, 4) NOT NULL,
  alert_type ENUM('INCREASE', 'DECREASE', 'VOLATILITY') NOT NULL,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_currency (currency),
  INDEX idx_is_processed (is_processed),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Alertas automáticas por cambios significativos en tipos de cambio';

-- 5. INSERTAR DATOS INICIALES
-- =====================================================

-- Insertar categorías principales y subcategorías
INSERT INTO categories (id, name, description, parent_id) VALUES
(1, 'Herramientas Manuales', 'Herramientas que no requieren electricidad', NULL),
(2, 'Herramientas Eléctricas', 'Herramientas que funcionan con electricidad', NULL),
(3, 'Materiales de Construcción', 'Materiales básicos para construcción', NULL),
(4, 'Equipos de Seguridad', 'Implementos para seguridad en el trabajo', NULL),
(5, 'Tornillos y Anclajes', 'Todo tipo de fijaciones', NULL),
(6, 'Fijaciones y Adhesivos', 'Pegamentos y adhesivos varios', NULL),
(7, 'Equipos de Medición', 'Instrumentos de medición', NULL),
-- Subcategorías de Herramientas Manuales
(8, 'Martillos', 'Martillos de diferentes tipos', 1),
(9, 'Destornilladores', 'Destornilladores manuales y eléctricos', 1),
(10, 'Llaves', 'Llaves de diferentes tipos', 1),
-- Subcategorías de Herramientas Eléctricas
(11, 'Taladros', 'Taladros percutores e inalámbricos', 2),
(12, 'Sierras', 'Sierras circulares, caladoras y de mesa', 2),
(13, 'Lijadoras', 'Lijadoras orbitales y de banda', 2),
-- Subcategorías de Materiales de Construcción
(14, 'Materiales Básicos', 'Cemento, arena, ladrillos, etc.', 3),
(15, 'Acabados', 'Pinturas, barnices, cerámicos, etc.', 3),
-- Subcategorías de Equipos de Seguridad
(16, 'Cascos', 'Cascos de seguridad', 4),
(17, 'Guantes', 'Guantes de protección', 4),
(18, 'Lentes de Seguridad', 'Lentes y gafas protectoras', 4),
(19, 'Accesorios Varios', 'Otros elementos de seguridad', 4),
-- Subcategorías de Tornillos y Anclajes
(20, 'Tornillos para Metal', 'Tornillos autoperforantes', 5),
(21, 'Tornillos para Madera', 'Tornillos para madera', 5),
(22, 'Tornillos para Concreto', 'Tornillos para concreto', 5),
(23, 'Tornillos Inoxidables', 'Tornillos de acero inoxidable', 5),
(24, 'Tirafondos', 'Tirafondos galvanizados', 5),
(25, 'Anclajes Expansivos', 'Anclajes expansivos', 5),
(26, 'Anclajes Químicos', 'Anclajes químicos', 5),
(27, 'Tacos y Tarugos', 'Tacos fischer y tarugos', 5),
(28, 'Clavos', 'Clavos comunes y especiales', 5),
(29, 'Pernos', 'Pernos roscados', 5),
-- Subcategorías de Fijaciones y Adhesivos
(30, 'Adhesivos Epóxicos', 'Adhesivos epóxicos', 6),
(31, 'Siliconas', 'Siliconas estructurales', 6),
(32, 'Pegamentos PVC', 'Pegamentos para PVC', 6),
(33, 'Selladores', 'Selladores de poliuretano', 6),
(34, 'Espumas', 'Espumas expansivas', 6),
(35, 'Cintas Adhesivas', 'Cintas de doble contacto', 6),
(36, 'Masillas', 'Masillas plásticas', 6),
(37, 'Adhesivos Instantáneos', 'Super glue y similares', 6),
(38, 'Soldaduras Frías', 'Soldaduras en frío', 6),
(39, 'Pegamentos Contacto', 'Pegamentos de contacto', 6),
-- Subcategorías de Equipos de Medición
(40, 'Cintas Métricas', 'Flexómetros y cintas métricas', 7),
(41, 'Niveles', 'Niveles de burbuja y láser', 7),
(42, 'Escuadras', 'Escuadras de carpintero', 7),
(43, 'Calibradores', 'Calibradores vernier', 7),
(44, 'Medidores Láser', 'Medidores láser de distancia', 7),
(45, 'Plomadas', 'Plomadas de bronce', 7),
(46, 'Transportadores', 'Transportadores de ángulos', 7),
(47, 'Reglas', 'Reglas metálicas graduadas', 7),
(48, 'Compases', 'Compases de puntas', 7),
(49, 'Micrómetros', 'Micrómetros de precisión', 7),
(50, 'Goniómetros', 'Goniómetros digitales', 7);

-- Insertar productos
INSERT INTO productos (id, sku, descripcion, categoria, subcategoria, precio, unidades) VALUES
(1, '100001', 'Martillo de Carpintero Stanley 16oz', 'Herramientas Manuales', 'Martillos', 12990.00, 45),
(2, '100002', 'Martillo de Goma Black & Decker', 'Herramientas Manuales', 'Martillos', 8990.00, 28),
(3, '100003', 'Martillo de Bola Truper 12oz', 'Herramientas Manuales', 'Martillos', 9990.00, 35),
(4, '100004', 'Martillo Demoledor Stanley 3lb', 'Herramientas Manuales', 'Martillos', 24990.00, 12),
(5, '100005', 'Martillo de Uña Dewalt 20oz', 'Herramientas Manuales', 'Martillos', 19990.00, 18),
(6, '100006', 'Destornillador Phillips Stanley #2', 'Herramientas Manuales', 'Destornilladores', 2990.00, 67),
(7, '100007', 'Destornillador Plano Bahco 6mm', 'Herramientas Manuales', 'Destornilladores', 3490.00, 42),
(8, '100008', 'Set Destornilladores Magnéticos Bosch 6pcs', 'Herramientas Manuales', 'Destornilladores', 15990.00, 23),
(9, '100009', 'Destornillador Eléctrico Black & Decker', 'Herramientas Manuales', 'Destornilladores', 29990.00, 15),
(10, '100010', 'Destornillador de Precisión Wera 12pcs', 'Herramientas Manuales', 'Destornilladores', 22990.00, 31),
(11, '100011', 'Llave Inglesa Adjustable Stanley 10"', 'Herramientas Manuales', 'Llaves', 12990.00, 38),
(12, '100012', 'Set Llaves Combinadas Bahco 8-19mm', 'Herramientas Manuales', 'Llaves', 89990.00, 14),
(13, '100013', 'Llave de Tubo Gedore 1/2"', 'Herramientas Manuales', 'Llaves', 45990.00, 26),
(14, '100014', 'Llave Allen Hexagonal Stanley 2.5mm', 'Herramientas Manuales', 'Llaves', 1990.00, 89),
(15, '100015', 'Set Llaves de Copa Craftsman 40pcs', 'Herramientas Manuales', 'Llaves', 199990.00, 8),
(16, '200001', 'Taladro Percutor Bosch GSB 13 RE', 'Herramientas Eléctricas', 'Taladros', 89990.00, 22),
(17, '200002', 'Taladro Inalámbrico Dewalt 20V', 'Herramientas Eléctricas', 'Taladros', 159990.00, 16),
(18, '200003', 'Taladro de Banco Ryobi 13mm', 'Herramientas Eléctricas', 'Taladros', 249990.00, 9),
(19, '200004', 'Taladro Atornillador Makita 12V', 'Herramientas Eléctricas', 'Taladros', 79990.00, 33),
(20, '200005', 'Taladro SDS Plus Hilti TE 2-A', 'Herramientas Eléctricas', 'Taladros', 399990.00, 6),
(21, '200006', 'Sierra Circular Skil 7 1/4"', 'Herramientas Eléctricas', 'Sierras', 69990.00, 19),
(22, '200007', 'Sierra de Mesa Dewalt DW745', 'Herramientas Eléctricas', 'Sierras', 349990.00, 7),
(23, '200008', 'Sierra Caladora Bosch PST 650', 'Herramientas Eléctricas', 'Sierras', 45990.00, 27),
(24, '200009', 'Sierra Sable Black & Decker RS500', 'Herramientas Eléctricas', 'Sierras', 39990.00, 24),
(25, '200010', 'Sierra Ingletadora Makita LS1018L', 'Herramientas Eléctricas', 'Sierras', 599990.00, 4),
(26, '200011', 'Lijadora Orbital Bosch PEX 220 A', 'Herramientas Eléctricas', 'Lijadoras', 59990.00, 29),
(27, '200012', 'Lijadora de Banda Makita 9403', 'Herramientas Eléctricas', 'Lijadoras', 199990.00, 11),
(28, '200013', 'Lijadora Delta Black & Decker', 'Herramientas Eléctricas', 'Lijadoras', 34990.00, 36),
(29, '200014', 'Lijadora Excéntrica Festool ETS 125', 'Herramientas Eléctricas', 'Lijadoras', 289990.00, 5),
(30, '200015', 'Lijadora de Pared Einhell TC-DW 225', 'Herramientas Eléctricas', 'Lijadoras', 89990.00, 21),
(31, '300001', 'Cemento Holcim Especial 25kg', 'Materiales de Construcción', 'Materiales Básicos', 4990.00, 156),
(32, '300002', 'Cemento Polpaico Ultra 25kg', 'Materiales de Construcción', 'Materiales Básicos', 5290.00, 142),
(33, '300003', 'Cemento Melón Premium 25kg', 'Materiales de Construcción', 'Materiales Básicos', 5490.00, 89),
(34, '300004', 'Cemento Biocemento 25kg', 'Materiales de Construcción', 'Materiales Básicos', 4790.00, 167),
(35, '300005', 'Arena Gruesa m³', 'Materiales de Construcción', 'Materiales Básicos', 25990.00, 73),
(36, '300006', 'Arena Fina m³', 'Materiales de Construcción', 'Materiales Básicos', 28990.00, 58),
(37, '300007', 'Gravilla 1/2" m³', 'Materiales de Construcción', 'Materiales Básicos', 32990.00, 42),
(38, '300008', 'Ripio m³', 'Materiales de Construcción', 'Materiales Básicos', 23990.00, 91),
(39, '300009', 'Ladrillo Príncipe 100 unidades', 'Materiales de Construcción', 'Materiales Básicos', 89990.00, 134),
(40, '300010', 'Ladrillo Fiscal 100 unidades', 'Materiales de Construcción', 'Materiales Básicos', 79990.00, 178),
(41, '300011', 'Bloque de Hormigón 20x20x40cm', 'Materiales de Construcción', 'Materiales Básicos', 2990.00, 245),
(42, '300012', 'Pintura Látex Sherwin Williams Blanco 1gl', 'Materiales de Construcción', 'Acabados', 19990.00, 67),
(43, '300013', 'Pintura Esmalte Tricolor Negro 1/4gl', 'Materiales de Construcción', 'Acabados', 8990.00, 83),
(44, '300014', 'Pintura Fachada Ceresita 15lt', 'Materiales de Construcción', 'Acabados', 45990.00, 29),
(45, '300015', 'Pintura Anticorrosiva Rust Mort 1lt', 'Materiales de Construcción', 'Acabados', 12990.00, 46),
(46, '300016', 'Barniz Marino Cristal 1/4gl', 'Materiales de Construcción', 'Acabados', 14990.00, 34),
(47, '300017', 'Barniz Poliuretano Mate 1lt', 'Materiales de Construcción', 'Acabados', 18990.00, 52),
(48, '300018', 'Sellador Madera Cetol 1lt', 'Materiales de Construcción', 'Acabados', 22990.00, 38),
(49, '300019', 'Cerámico Piso San Lorenzo 60x60cm', 'Materiales de Construcción', 'Acabados', 12990.00, 95),
(50, '300020', 'Cerámico Mural Cordillera 25x40cm', 'Materiales de Construcción', 'Acabados', 8990.00, 112),
(51, '300021', 'Porcelanato Ilva 60x60cm Rectificado', 'Materiales de Construcción', 'Acabados', 24990.00, 67),
(52, '400001', 'Casco de Seguridad 3M H-701R', 'Equipos de Seguridad', 'Cascos', 15990.00, 78),
(53, '400002', 'Casco MSA V-Gard con Barbiquejo', 'Equipos de Seguridad', 'Cascos', 22990.00, 45),
(54, '400003', 'Casco Ventilado Honeywell North', 'Equipos de Seguridad', 'Cascos', 18990.00, 62),
(55, '400004', 'Guantes Nitrilo Ansell Hyflex', 'Equipos de Seguridad', 'Guantes', 8990.00, 134),
(56, '400005', 'Guantes Cuero Vacuno Reforzados', 'Equipos de Seguridad', 'Guantes', 12990.00, 89),
(57, '400006', 'Guantes Dieléctricos Clase 2', 'Equipos de Seguridad', 'Guantes', 45990.00, 23),
(58, '400007', 'Guantes Anticorte Nivel 5', 'Equipos de Seguridad', 'Guantes', 19990.00, 56),
(59, '400008', 'Lentes de Seguridad 3M Virtua', 'Equipos de Seguridad', 'Lentes de Seguridad', 7990.00, 167),
(60, '400009', 'Lentes Graduados Uvex Skyper', 'Equipos de Seguridad', 'Lentes de Seguridad', 24990.00, 34),
(61, '400010', 'Lentes Soldadura Din 11', 'Equipos de Seguridad', 'Lentes de Seguridad', 15990.00, 47),
(62, '400011', 'Máscara Respirador 3M 6200', 'Equipos de Seguridad', 'Accesorios Varios', 35990.00, 28),
(63, '400012', 'Chaleco Reflectante Clase 2', 'Equipos de Seguridad', 'Accesorios Varios', 8990.00, 145),
(64, '400013', 'Arnés de Seguridad 3 Puntos', 'Equipos de Seguridad', 'Accesorios Varios', 45990.00, 19),
(65, '400014', 'Zapatos de Seguridad Bata Industrial', 'Equipos de Seguridad', 'Accesorios Varios', 39990.00, 72),
(66, '500001', 'Tornillo Autoperforante 8x1 1/2"', 'Tornillos y Anclajes', 'Tornillos para Metal', 290.00, 2456),
(67, '500002', 'Tornillo Madera 6x40mm Cabeza Plana', 'Tornillos y Anclajes', 'Tornillos para Madera', 180.00, 3789),
(68, '500003', 'Tornillo Concreto 8x80mm Hexagonal', 'Tornillos y Anclajes', 'Tornillos para Concreto', 890.00, 1245),
(69, '500004', 'Tornillo Inoxidable 6x25mm Phillips', 'Tornillos y Anclajes', 'Tornillos Inoxidables', 420.00, 1876),
(70, '500005', 'Tirafondo 1/4"x3" Galvanizado', 'Tornillos y Anclajes', 'Tirafondos', 590.00, 967),
(71, '500006', 'Anclaje Expansivo Hilti 10x80mm', 'Tornillos y Anclajes', 'Anclajes Expansivos', 2990.00, 89),
(72, '500007', 'Anclaje Químico Sika AnchorFix 300ml', 'Tornillos y Anclajes', 'Anclajes Químicos', 15990.00, 34),
(73, '500008', 'Taco Fischer SX 8x40mm', 'Tornillos y Anclajes', 'Tacos y Tarugos', 590.00, 1567),
(74, '500009', 'Clavo Común 2 1/2" kg', 'Tornillos y Anclajes', 'Clavos', 3990.00, 234),
(75, '500010', 'Perno Roscado 1/2"x6" Galvanizado', 'Tornillos y Anclajes', 'Pernos', 1990.00, 456),
(76, '600001', 'Adhesivo Epóxico Loctite 5 Minutos', 'Fijaciones y Adhesivos', 'Adhesivos Epóxicos', 8990.00, 67),
(77, '600002', 'Silicona Estructural Dow Corning', 'Fijaciones y Adhesivos', 'Siliconas', 12990.00, 45),
(78, '600003', 'Pegamento PVC Tigre 175ml', 'Fijaciones y Adhesivos', 'Pegamentos PVC', 4990.00, 123),
(79, '600004', 'Sellador Poliuretano Sikaflex 1A', 'Fijaciones y Adhesivos', 'Selladores', 8990.00, 78),
(80, '600005', 'Espuma Expansiva Sika Boom 750ml', 'Fijaciones y Adhesivos', 'Espumas', 6990.00, 92),
(81, '600006', 'Cinta Doble Contacto 3M 19mm', 'Fijaciones y Adhesivos', 'Cintas Adhesivas', 3990.00, 234),
(82, '600007', 'Masilla Plástica Bondo 453gr', 'Fijaciones y Adhesivos', 'Masillas', 14990.00, 56),
(83, '600008', 'Adhesivo Instantáneo Super Glue 20gr', 'Fijaciones y Adhesivos', 'Adhesivos Instantáneos', 2990.00, 189),
(84, '600009', 'Soldadura Fría JB Weld 56gr', 'Fijaciones y Adhesivos', 'Soldaduras Frías', 9990.00, 43),
(85, '600010', 'Pegamento Contacto Agorex 1lt', 'Fijaciones y Adhesivos', 'Pegamentos Contacto', 18990.00, 67),
(86, '700001', 'Flexómetro Stanley 5m FatMax', 'Equipos de Medición', 'Cintas Métricas', 7990.00, 145),
(87, '700002', 'Flexómetro Profesional Stabila 8m', 'Equipos de Medición', 'Cintas Métricas', 18990.00, 67),
(88, '700003', 'Cinta Métrica Lufkin 30m', 'Equipos de Medición', 'Cintas Métricas', 45990.00, 23),
(89, '700004', 'Nivel de Burbuja Stanley 60cm', 'Equipos de Medición', 'Niveles', 12990.00, 89),
(90, '700005', 'Nivel Láser Bosch GLL 3-80', 'Equipos de Medición', 'Niveles', 299990.00, 12),
(91, '700006', 'Nivel Magnético Stabila 40cm', 'Equipos de Medición', 'Niveles', 35990.00, 34),
(92, '700007', 'Escuadra Carpintero Stanley 30cm', 'Equipos de Medición', 'Escuadras', 8990.00, 78),
(93, '700008', 'Calibrador Vernier Mitutoyo 150mm', 'Equipos de Medición', 'Calibradores', 89990.00, 19),
(94, '700009', 'Medidor Láser Distancia Bosch GLM 50', 'Equipos de Medición', 'Medidores Láser', 149990.00, 26),
(95, '700010', 'Plomada de Bronce 500gr', 'Equipos de Medición', 'Plomadas', 12990.00, 45),
(96, '700011', 'Transportador Ángulos Stanley', 'Equipos de Medición', 'Transportadores', 15990.00, 52),
(97, '700012', 'Regla Metálica 100cm Graduada', 'Equipos de Medición', 'Reglas', 19990.00, 67),
(98, '700013', 'Compás de Puntas Stanley', 'Equipos de Medición', 'Compases', 22990.00, 38),
(99, '700014', 'Micrómetro Starrett 0-25mm', 'Equipos de Medición', 'Micrómetros', 199990.00, 14),
(100, '700015', 'Goniómetro Digital Wixey WR300', 'Equipos de Medición', 'Goniómetros', 79990.00, 27);

-- Insertar usuarios del sistema
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Juan Pérez', 'admin@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'administrador'),
('María González', 'vendedor1@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'vendedor'),
('Carlos Silva', 'vendedor2@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'vendedor'),
('Ana Morales', 'bodeguero1@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'bodeguero'),
('Luis Rojas', 'bodeguero2@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'bodeguero'),
('Patricia Castro', 'contador@ferremas.cl', '$2b$10$XtUuiA1VE5LKE88FZ5U2qOrpBqRKr7R3VqVDu3cVyC1Kb1/xHPKDa', 'contador');

-- Insertar clientes
INSERT INTO clientes (rut, nombre, apellido, email, telefono, direccion, ciudad, region) VALUES
('12345678-9', 'Pedro', 'Martínez', 'pedro.martinez@email.com', '+56912345678', 'Av. Providencia 1234', 'Santiago', 'Metropolitana'),
('23456789-0', 'Carmen', 'López', 'carmen.lopez@email.com', '+56923456789', 'Santa Rosa 567', 'Santiago', 'Metropolitana'),
('34567890-1', 'Roberto', 'Hernández', 'roberto.hernandez@email.com', '+56934567890', 'Las Condes 890', 'Santiago', 'Metropolitana'),
('45678901-2', 'Elena', 'Vargas', 'elena.vargas@email.com', '+56945678901', 'Maipú 123', 'Santiago', 'Metropolitana'),
('56789012-3', 'Miguel', 'Torres', 'miguel.torres@email.com', '+56956789012', 'O\'Higgins 456', 'Viña del Mar', 'Valparaíso'),
('67890123-4', 'Claudia', 'Ramírez', 'claudia.ramirez@email.com', '+56967890123', 'Barros Arana 789', 'Concepción', 'Biobío'),
('78901234-5', 'Fernando', 'Díaz', 'fernando.diaz@email.com', '+56978901234', 'Manuel Montt 321', 'Temuco', 'Araucanía'),
('89012345-6', 'Sofía', 'Mendoza', 'sofia.mendoza@email.com', '+56989012345', 'Baquedano 654', 'Antofagasta', 'Antofagasta'),
('90123456-7', 'Andrés', 'Fuentes', 'andres.fuentes@email.com', '+56990123456', 'Independencia 987', 'La Serena', 'Coquimbo'),
('01234567-8', 'Valentina', 'Soto', 'valentina.soto@email.com', '+56901234567', 'Arturo Prat 246', 'Puerto Montt', 'Los Lagos');

-- Insertar sucursales en Santiago, Chile
INSERT INTO sucursales (nombre, direccion, comuna, telefono, email, horario_atencion) VALUES
('FERREMAS Central', 'Av. Providencia 1234', 'Providencia', '+56225551001', 'central@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 9:00-14:00'),
('FERREMAS Las Condes', 'Av. Apoquindo 4500', 'Las Condes', '+56225551002', 'lascondes@ferremas.cl', 'Lunes a Viernes 8:30-18:30, Sábados 9:00-15:00'),
('FERREMAS Maipú', 'Av. Pajaritos 1850', 'Maipú', '+56225551003', 'maipu@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 8:30-14:30'),
('FERREMAS San Miguel', 'Gran Avenida 3200', 'San Miguel', '+56225551004', 'sanmiguel@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 9:00-14:00'),
('FERREMAS Ñuñoa', 'Av. Irarrázaval 2890', 'Ñuñoa', '+56225551005', 'nunoa@ferremas.cl', 'Lunes a Viernes 8:30-18:30, Sábados 9:00-15:00'),
('FERREMAS La Florida', 'Av. Vicuña Mackenna 6754', 'La Florida', '+56225551006', 'laflorida@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 8:30-14:30'),
('FERREMAS Independencia', 'Av. Independencia 1456', 'Independencia', '+56225551007', 'independencia@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 9:00-14:00'),
('FERREMAS Puente Alto', 'Av. Concha y Toro 1789', 'Puente Alto', '+56225551008', 'puentealto@ferremas.cl', 'Lunes a Viernes 8:30-18:30, Sábados 9:00-15:00'),
('FERREMAS Quilicura', 'Av. Matta 2345', 'Quilicura', '+56225551009', 'quilicura@ferremas.cl', 'Lunes a Viernes 8:00-18:00, Sábados 8:30-14:30'),
('FERREMAS Santiago Centro', 'Alameda 1567', 'Santiago', '+56225551010', 'centro@ferremas.cl', 'Lunes a Viernes 8:00-19:00, Sábados 9:00-16:00');

-- Insertar datos de ejemplo para carritos
INSERT INTO carritos (session_id, cliente_id) VALUES
('sess_123456789', 1),
('sess_987654321', 2),
('sess_555666777', NULL), -- Usuario anónimo
('sess_111222333', 3);

-- Items de carrito de ejemplo
INSERT INTO carrito_items (carrito_id, producto_id, cantidad, precio_unitario) VALUES
-- Carrito 1 (cliente Pedro Martínez)
(1, 1, 2, 12990.00),  -- 2 Martillos Stanley
(1, 16, 1, 89990.00), -- 1 Taladro Bosch
(1, 52, 1, 15990.00), -- 1 Casco de Seguridad
-- Carrito 2 (cliente Carmen López)
(2, 31, 5, 4990.00),  -- 5 Sacos de Cemento
(2, 42, 2, 19990.00), -- 2 Galones de Pintura
(2, 86, 1, 7990.00),  -- 1 Flexómetro
-- Carrito 3 (usuario anónimo)
(3, 6, 3, 2990.00),   -- 3 Destornilladores Phillips
(3, 14, 5, 1990.00),  -- 5 Llaves Allen
-- Carrito 4 (cliente Roberto Hernández)
(4, 25, 1, 599990.00), -- 1 Sierra Ingletadora Makita
(4, 66, 100, 290.00),  -- 100 Tornillos Autoperforantes
(4, 74, 2, 3990.00);   -- 2 kg de Clavos

-- Insertar movimientos de inventario de ejemplo
INSERT INTO movimientos_inventario (producto_id, stock_anterior, stock_nuevo, tipo_operacion, motivo, usuario_id) VALUES
(1, 40, 45, 'RESTOCK', 'Recepción de mercadería proveedor Stanley', 1),
(16, 25, 22, 'VENTA', 'Venta online - pedido #001', 2),
(31, 150, 156, 'RESTOCK', 'Llegada camión Holcim', 4),
(66, 2400, 2456, 'RESTOCK', 'Pedido masivo tornillos', 4),
(52, 80, 78, 'VENTA', 'Venta equipos de seguridad', 2);

-- Insertar datos de ejemplo para pagos
INSERT INTO pagos (orden_compra, cliente_id, session_id, monto, metodo_pago, estado, email_comprador, telefono_comprador, descripcion) VALUES
('ORD-2024-001', 1, 'sess_123456789', 102980.00, 'webpay', 'aprobado', 'pedro.martinez@email.com', '+56912345678', 'Compra herramientas - Martillos y Taladro'),
('ORD-2024-002', 2, 'sess_987654321', 74950.00, 'webpay', 'aprobado', 'carmen.lopez@email.com', '+56923456789', 'Compra materiales construcción'),
('ORD-2024-003', NULL, 'sess_555666777', 14970.00, 'webpay', 'pendiente', 'cliente@temp.com', '+56911111111', 'Compra anónima - Destornilladores'),
('ORD-2024-004', 3, 'sess_111222333', 607970.00, 'transferencia', 'procesando', 'roberto.hernandez@email.com', '+56934567890', 'Compra mayor - Sierra y tornillos');

-- Insertar items de los pagos
INSERT INTO pago_items (pago_id, producto_id, cantidad, precio_unitario) VALUES
-- Pago 1 (Pedro Martínez)
(1, 1, 2, 12990.00),  -- 2 Martillos Stanley
(1, 16, 1, 89990.00), -- 1 Taladro Bosch
-- Pago 2 (Carmen López)  
(2, 31, 5, 4990.00),  -- 5 Sacos de Cemento
(2, 42, 2, 19990.00), -- 2 Galones de Pintura
(2, 86, 1, 7990.00),  -- 1 Flexómetro
-- Pago 3 (Usuario anónimo)
(3, 6, 3, 2990.00),   -- 3 Destornilladores Phillips
(3, 14, 5, 1990.00),  -- 5 Llaves Allen
-- Pago 4 (Roberto Hernández)
(4, 25, 1, 599990.00), -- 1 Sierra Ingletadora
(4, 66, 100, 290.00),  -- 100 Tornillos
(4, 74, 2, 3990.00);   -- 2 kg de Clavos

-- Insertar logs de WebPay de ejemplo
INSERT INTO webpay_log (pago_id, operacion, request_data, response_data, codigo_respuesta, mensaje_respuesta, success) VALUES
(1, 'crear_transaccion', '{"amount": 102980, "buy_order": "ORD-2024-001"}', '{"token": "01ab23cd45ef67890", "url": "https://webpay3gint.transbank.cl/webpayserver/initTransaction"}', '0', 'Transacción creada exitosamente', TRUE),
(1, 'confirmar_transaccion', '{"token": "01ab23cd45ef67890"}', '{"response_code": 0, "authorization_code": "1234567890"}', '0', 'Transacción aprobada', TRUE),
(2, 'crear_transaccion', '{"amount": 74950, "buy_order": "ORD-2024-002"}', '{"token": "02bc34de56fg78901", "url": "https://webpay3gint.transbank.cl/webpayserver/initTransaction"}', '0', 'Transacción creada exitosamente', TRUE),
(2, 'confirmar_transaccion', '{"token": "02bc34de56fg78901"}', '{"response_code": 0, "authorization_code": "0987654321"}', '0', 'Transacción aprobada', TRUE);

-- Insertar configuración inicial de monedas
INSERT INTO currency_config (currency_code, currency_name, currency_symbol, bcch_series_code, is_active, decimal_places, display_order) VALUES
('CLP', 'Peso Chileno', '', NULL, TRUE, 0, 1),
('USD', 'Dólar Estadounidense', 'US, 'F073.TCO.PRE.Z.D', TRUE, 2, 2),
('EUR', 'Euro', '€', 'F072.CLP.EUR.N.O.D', TRUE, 2, 3),
('UF', 'Unidad de Fomento', 'UF', 'F073.UF.CLP.Z.D', TRUE, 2, 4),
('UTM', 'Unidad Tributaria Mensual', 'UTM', 'F073.UTM.CLP.Z.D', TRUE, 0, 5),
('GBP', 'Libra Esterlina', '£', 'F072.CLP.GBP.N.O.D', FALSE, 2, 6),
('JPY', 'Yen Japonés', '¥', 'F072.CLP.JPY.N.O.D', FALSE, 0, 7);

-- Insertar algunos datos de ejemplo para currency rates (valores aproximados para testing)
INSERT INTO currency_rates (currency, exchange_rate, rate_date, source) VALUES
('USD', 941.20, CURDATE(), 'BCCH_API'),
('EUR', 1042.42, CURDATE(), 'BCCH_API'),
('UF', 39144.01, CURDATE(), 'BCCH_API'),
('UTM', 68648.00, CURDATE(), 'BCCH_API');

-- Insertar algunos ejemplos de conversiones
INSERT INTO currency_conversions (amount, from_currency, to_currency, exchange_rate, converted_amount, conversion_date) VALUES
(100.00, 'USD', 'CLP', 941.20, 94120.00, CURDATE()),
(50000.00, 'CLP', 'USD', 0.00106, 53.06, CURDATE()),
(1.00, 'UF', 'CLP', 39144.01, 39144.01, CURDATE()),
(1000000.00, 'CLP', 'EUR', 0.00096, 958.97, CURDATE());

-- 6. CREAR PROCEDIMIENTOS Y FUNCIONES
-- =====================================================

-- PROCEDIMIENTO: Limpiar datos antiguos
DELIMITER //
CREATE PROCEDURE CleanOldCurrencyData()
BEGIN
    -- Limpiar conversiones más antiguas de 90 días
    DELETE FROM currency_conversions 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- Limpiar rates más antiguos de 30 días (excepto los del último día de cada mes)
    DELETE cr1 FROM currency_rates cr1
    WHERE cr1.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND NOT EXISTS (
        SELECT 1 FROM currency_rates cr2 
        WHERE cr2.currency = cr1.currency 
        AND LAST_DAY(cr2.rate_date) = cr2.rate_date
        AND cr2.id = cr1.id
    );
    
    -- Limpiar alertas procesadas más antiguas de 7 días
    DELETE FROM currency_alerts 
    WHERE is_processed = TRUE 
    AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    SELECT 'Limpieza de datos completada' as mensaje;
END //
DELIMITER ;

-- FUNCIÓN: Obtener tasa de cambio más reciente
DELIMITER //
CREATE FUNCTION GetLatestExchangeRate(p_currency VARCHAR(10))
RETURNS DECIMAL(15,6)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_rate DECIMAL(15,6) DEFAULT 1.0;
    
    -- Si es CLP, retornar 1
    IF p_currency = 'CLP' THEN
        RETURN 1.0;
    END IF;
    
    -- Obtener el rate más reciente
    SELECT exchange_rate INTO v_rate
    FROM currency_rates 
    WHERE currency = p_currency 
    AND rate_date <= CURDATE()
    ORDER BY rate_date DESC, updated_at DESC 
    LIMIT 1;
    
    RETURN IFNULL(v_rate, 0.0);
END //
DELIMITER ;

-- FUNCIÓN: Convertir monto entre monedas
DELIMITER //
CREATE FUNCTION ConvertCurrency(p_amount DECIMAL(15,6), p_from_currency VARCHAR(10), p_to_currency VARCHAR(10))
RETURNS DECIMAL(15,6)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_from_rate DECIMAL(15,6);
    DECLARE v_to_rate DECIMAL(15,6);
    DECLARE v_amount_in_clp DECIMAL(15,6);
    DECLARE v_converted_amount DECIMAL(15,6);
    
    -- Si es la misma moneda, retornar el mismo monto
    IF p_from_currency = p_to_currency THEN
        RETURN p_amount;
    END IF;
    
    -- Obtener rates
    SET v_from_rate = GetLatestExchangeRate(p_from_currency);
    SET v_to_rate = GetLatestExchangeRate(p_to_currency);
    
    -- Convertir a CLP primero
    IF p_from_currency = 'CLP' THEN
        SET v_amount_in_clp = p_amount;
    ELSE
        SET v_amount_in_clp = p_amount * v_from_rate;
    END IF;
    
    -- Convertir de CLP a moneda destino
    IF p_to_currency = 'CLP' THEN
        SET v_converted_amount = v_amount_in_clp;
    ELSE
        SET v_converted_amount = v_amount_in_clp / v_to_rate;
    END IF;
    
    RETURN v_converted_amount;
END //
DELIMITER ;

-- 7. CREAR TRIGGERS
-- =====================================================

-- TRIGGER: Crear alerta cuando hay cambio significativo en currency rates
DELIMITER //
CREATE TRIGGER currency_rate_change_alert
    AFTER INSERT ON currency_rates
    FOR EACH ROW
BEGIN
    DECLARE v_previous_rate DECIMAL(15,6);
    DECLARE v_change_percentage DECIMAL(8,4);
    DECLARE v_threshold DECIMAL(8,4) DEFAULT 5.0; -- 5% threshold
    
    -- Obtener rate anterior
    SELECT exchange_rate INTO v_previous_rate
    FROM currency_rates 
    WHERE currency = NEW.currency 
    AND rate_date < NEW.rate_date
    ORDER BY rate_date DESC, updated_at DESC 
    LIMIT 1;
    
    -- Si hay rate anterior, calcular cambio
    IF v_previous_rate IS NOT NULL AND v_previous_rate > 0 THEN
        SET v_change_percentage = ((NEW.exchange_rate - v_previous_rate) / v_previous_rate) * 100;
        
        -- Si el cambio supera el threshold, crear alerta
        IF ABS(v_change_percentage) >= v_threshold THEN
            INSERT INTO currency_alerts (
                currency, 
                previous_rate, 
                current_rate, 
                change_percentage, 
                threshold_percentage,
                alert_type
            ) VALUES (
                NEW.currency,
                v_previous_rate,
                NEW.exchange_rate,
                v_change_percentage,
                v_threshold,
                CASE 
                    WHEN v_change_percentage > 0 THEN 'INCREASE'
                    ELSE 'DECREASE'
                END
            );
        END IF;
    END IF;
END //
DELIMITER ;

-- 8. CREAR VISTAS
-- =====================================================

-- VISTA: Resumen de tipos de cambio actuales
CREATE OR REPLACE VIEW current_exchange_rates AS
SELECT 
    cc.currency_code,
    cc.currency_name,
    cc.currency_symbol,
    cr.exchange_rate,
    cr.rate_date,
    cr.updated_at,
    cc.decimal_places,
    CASE 
        WHEN cr.updated_at > DATE_SUB(NOW(), INTERVAL 4 HOUR) THEN 'CURRENT'
        WHEN cr.updated_at > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 'RECENT'
        ELSE 'OUTDATED'
    END as freshness_status
FROM currency_config cc
LEFT JOIN currency_rates cr ON cc.currency_code = cr.currency
LEFT JOIN (
    -- Subconsulta para obtener el rate más reciente de cada moneda
    SELECT currency, MAX(rate_date) as max_date, MAX(updated_at) as max_updated
    FROM currency_rates 
    GROUP BY currency
) latest ON cr.currency = latest.currency 
    AND cr.rate_date = latest.max_date 
    AND cr.updated_at = latest.max_updated
WHERE cc.is_active = TRUE
ORDER BY cc.display_order;

-- VISTA: Estadísticas de conversiones
CREATE OR REPLACE VIEW conversion_statistics AS
SELECT 
    from_currency,
    to_currency,
    COUNT(*) as total_conversions,
    SUM(amount) as total_amount_converted,
    AVG(exchange_rate) as avg_exchange_rate,
    MIN(conversion_date) as first_conversion,
    MAX(conversion_date) as last_conversion,
    DATE(created_at) as conversion_day,
    COUNT(DISTINCT user_session) as unique_users
FROM currency_conversions
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY from_currency, to_currency, DATE(created_at)
ORDER BY conversion_day DESC, total_conversions DESC;

-- VISTA: Resumen de productos con inventario
CREATE OR REPLACE VIEW productos_inventario AS
SELECT 
    p.id,
    p.sku,
    p.descripcion,
    p.categoria,
    p.subcategoria,
    p.precio,
    p.unidades,
    p.activo,
    CASE 
        WHEN p.unidades <= 0 THEN 'SIN_STOCK'
        WHEN p.unidades <= 5 THEN 'STOCK_BAJO'
        WHEN p.unidades <= 20 THEN 'STOCK_MEDIO'
        ELSE 'STOCK_ALTO'
    END as nivel_stock,
    p.created_at,
    p.updated_at
FROM productos p
WHERE p.activo = TRUE
ORDER BY p.categoria, p.subcategoria, p.descripcion;

-- VISTA: Resumen de ventas por producto
CREATE OR REPLACE VIEW ventas_por_producto AS
SELECT 
    p.id as producto_id,
    p.sku,
    p.descripcion,
    p.categoria,
    p.subcategoria,
    p.precio,
    COALESCE(SUM(pi.cantidad), 0) as total_vendido,
    COALESCE(SUM(pi.subtotal), 0) as total_ingresos,
    COUNT(DISTINCT pag.id) as total_ordenes,
    AVG(pi.precio_unitario) as precio_promedio_venta
FROM productos p
LEFT JOIN pago_items pi ON p.id = pi.producto_id
LEFT JOIN pagos pag ON pi.pago_id = pag.id AND pag.estado = 'aprobado'
WHERE p.activo = TRUE
GROUP BY p.id, p.sku, p.descripcion, p.categoria, p.subcategoria, p.precio
ORDER BY total_ingresos DESC;

-- 9. CONFIGURACIONES FINALES
-- =====================================================

-- Reactivar verificaciones de foreign keys
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar que las tablas se crearon correctamente
SELECT 
    TABLE_NAME,
    TABLE_COMMENT,
    CREATE_TIME,
    TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'ferremas_db'
ORDER BY TABLE_NAME;

-- Mostrar información de las funciones creadas
SELECT 
    ROUTINE_NAME,
    ROUTINE_TYPE,
    DATA_TYPE,
    ROUTINE_COMMENT
FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_SCHEMA = 'ferremas_db'
ORDER BY ROUTINE_TYPE, ROUTINE_NAME;

-- Mostrar información de las vistas creadas
SELECT 
    TABLE_NAME,
    VIEW_DEFINITION
FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_SCHEMA = 'ferremas_db'
ORDER BY TABLE_NAME;

-- 10. CONSULTAS DE VERIFICACIÓN
-- =====================================================

-- Verificar integridad de datos
SELECT 'Productos activos' as descripcion, COUNT(*) as cantidad FROM productos WHERE activo = TRUE
UNION ALL
SELECT 'Categorías activas' as descripcion, COUNT(*) as cantidad FROM categories WHERE activa = TRUE
UNION ALL
SELECT 'Usuarios activos' as descripcion, COUNT(*) as cantidad FROM usuarios WHERE activo = TRUE
UNION ALL
SELECT 'Clientes activos' as descripcion, COUNT(*) as cantidad FROM clientes WHERE activo = TRUE
UNION ALL
SELECT 'Sucursales activas' as descripcion, COUNT(*) as cantidad FROM sucursales WHERE activa = TRUE
UNION ALL
SELECT 'Carritos con items' as descripcion, COUNT(DISTINCT carrito_id) as cantidad FROM carrito_items
UNION ALL
SELECT 'Pagos registrados' as descripcion, COUNT(*) as cantidad FROM pagos
UNION ALL
SELECT 'Monedas configuradas' as descripcion, COUNT(*) as cantidad FROM currency_config;

-- Mensaje de finalización
SELECT 
    'BASE DE DATOS FERREMAS CREADA EXITOSAMENTE' as mensaje,
    NOW() as fecha_creacion,
    'Script ejecutado sin errores' as estado;