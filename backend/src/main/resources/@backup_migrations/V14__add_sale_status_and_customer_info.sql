-- ============================================================
-- V14: Estado de Venta, Motivo de Anulación e Información de Cliente
-- ============================================================

-- 1. Agregar columnas para estado y anulación
ALTER TABLE ventas ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE ventas ADD COLUMN motivo_anulacion TEXT;

-- 2. Agregar columnas para información del cliente (Opcional por factura)
ALTER TABLE ventas ADD COLUMN cliente_nombre VARCHAR(100);
ALTER TABLE ventas ADD COLUMN cliente_documento VARCHAR(20);

-- 3. Crear índice para búsquedas por estado
CREATE INDEX idx_venta_estado ON ventas(estado);
