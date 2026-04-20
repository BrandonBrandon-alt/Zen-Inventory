CREATE TABLE sucursal (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rol (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol_id BIGINT NOT NULL REFERENCES rol(id),
    sucursal_id BIGINT REFERENCES sucursal(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proveedor (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    contacto VARCHAR(150),
    tiempo_entrega_dias INT DEFAULT 0
);

CREATE TABLE producto (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    costo_promedio DECIMAL(12, 2) DEFAULT 0.0,
    precio_venta DECIMAL(12, 2) DEFAULT 0.0,
    proveedor_id BIGINT REFERENCES proveedor(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unidad_medida (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    abreviatura VARCHAR(10) NOT NULL
);

CREATE TABLE producto_unidad (
    id BIGSERIAL PRIMARY KEY,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    unidad_id BIGINT NOT NULL REFERENCES unidad_medida(id),
    factor_conversion DECIMAL(10, 4) DEFAULT 1.0,
    es_base BOOLEAN DEFAULT FALSE,
    UNIQUE(producto_id, unidad_id)
);

CREATE TABLE inventario_local (
    id BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    cantidad_actual DECIMAL(12, 4) DEFAULT 0.0,
    stock_minimo DECIMAL(12, 4) DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sucursal_id, producto_id)
);

CREATE TABLE movimiento_inventario (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL, -- INGRESO, RETIRO
    motivo VARCHAR(50) NOT NULL, -- VENTA, COMPRA, TRASLADO, MERMA, AJUSTE
    cantidad DECIMAL(12, 4) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    referencia_id BIGINT,
    tipo_referencia VARCHAR(50)
);

-- Insertar roles base
INSERT INTO rol (nombre) VALUES ('ADMIN'), ('GERENTE_SUCURSAL'), ('OPERADOR_INVENTARIO');
