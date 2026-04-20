-- ============================================================
-- V12: Tablas de Compras y Actualización de Matriz de Roles (RBAC)
-- ============================================================

-- 1. Actualización de Nombres de Roles (Matriz RBAC estándar)
UPDATE rol SET nombre = 'MANAGER' WHERE nombre = 'GERENTE_SUCURSAL';
UPDATE rol SET nombre = 'SELLER' WHERE nombre = 'OPERADOR_INVENTARIO';

/**
 * Limpieza de esquema previo (V3/V6):
 * Como estamos reconstruyendo el módulo de compras para soportar estados duales 
 * y trazabilidad de recepción, reemplazamos las tablas existentes.
 */
DROP TABLE IF EXISTS detalles_compra CASCADE;
DROP TABLE IF EXISTS detalles_orden_compra CASCADE;
DROP TABLE IF EXISTS ordenes_compra CASCADE;

-- 2. Tabla de Cabecera: ordenes_compra
-- Maneja la transacción financiera y el ciclo de vida logístico
CREATE TABLE ordenes_compra (
    id BIGSERIAL PRIMARY KEY,
    proveedor_id BIGINT NOT NULL REFERENCES proveedor(id),
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id), -- Autorizador
    usuario_recepcion_id BIGINT REFERENCES usuario(id), -- Quien recibe físicamente
    
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_estimada_llegada TIMESTAMP,
    fecha_real_llegada TIMESTAMP,
    
    estado_recepcion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- PENDING, IN_TRANSIT, RECEIVED_TOTAL, etc.
    estado_pago VARCHAR(30) NOT NULL DEFAULT 'POR_PAGAR',    -- POR_PAGAR, PAGO_PARCIAL, PAGADO
    
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Detalle: detalles_orden_compra
-- "Congela" el precio unitario pactado al momento de la compra
CREATE TABLE detalles_orden_compra (
    id BIGSERIAL PRIMARY KEY,
    orden_id BIGINT NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    
    cantidad DECIMAL(12, 4) NOT NULL, -- Soporte para bultos/fracciones si fuera necesario
    precio_unitario_pactado DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL
);

-- Indices para optimización de reportes
CREATE INDEX idx_orden_recepcion ON ordenes_compra(estado_recepcion);
CREATE INDEX idx_orden_pago ON ordenes_compra(estado_pago);
CREATE INDEX idx_orden_sucursal ON ordenes_compra(sucursal_id);
