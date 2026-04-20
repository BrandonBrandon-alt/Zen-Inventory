-- ============================================================
-- V13: Refactorización Profesional del Módulo de Ventas (POS)
-- ============================================================

-- Eliminamos la estructura básica previa para reconstruir con lógica financiera avanzada
DROP TABLE IF EXISTS detalles_venta CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;

-- 1. Cabecera de la Venta (Representa el comprobante final)
CREATE TABLE ventas (
    id BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id), -- El SELLER que realizó la transacción
    
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Totales consolidados (Calculados en Backend)
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    descuento_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_final DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Detalles de la Venta (Items individuales con precio congelado)
CREATE TABLE detalles_venta (
    id BIGSERIAL PRIMARY KEY,
    venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    
    cantidad INT NOT NULL,
    precio_unitario_aplicado DECIMAL(12, 2) NOT NULL, -- Precio del catálogo al momento de la venta
    porcentaje_descuento DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Descuento específico para esta línea
    subtotal_linea DECIMAL(12, 2) NOT NULL -- cantidad * precio * (1 - descuento)
);

-- Índices para reportes de ventas y auditoría
CREATE INDEX idx_venta_sucursal ON ventas(sucursal_id);
CREATE INDEX idx_venta_vendedor ON ventas(usuario_id);
CREATE INDEX idx_venta_fecha ON ventas(fecha);
