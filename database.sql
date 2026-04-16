CREATE DATABASE IF NOT EXISTS consoleworld;
USE consoleworld;

-- Tabla para Tiendas Oficiales
CREATE TABLE IF NOT EXISTS tiendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    lat_offset DECIMAL(8,5) NOT NULL,
    lon_offset DECIMAL(8,5) NOT NULL
);

-- Datos iniciales para Tiendas
INSERT INTO tiendas (nombre, lat_offset, lon_offset) VALUES
('ConsoleWorld Matriz', 0.00500, 0.01500),
('ConsoleWorld Plaza', -0.01000, -0.02000);

-- Tabla para Órdenes/Pagos
CREATE TABLE IF NOT EXISTS ordenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_orden VARCHAR(20) NOT NULL,
    cliente VARCHAR(100) NOT NULL,
    productos TEXT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para Usuarios Registrados
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);
