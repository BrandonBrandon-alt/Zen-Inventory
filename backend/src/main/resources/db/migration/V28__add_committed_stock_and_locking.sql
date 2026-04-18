-- ============================================================
-- V28: Gestión de Stock Comprometido y Control de Concurrencia
-- ============================================================

-- 1. Añadir stock comprometido a la matriz de inventario
-- Usamos DECIMAL(12,4) para coincidir con cantidad_actual y soportar fracciones (Agro)
ALTER TABLE inventario_local 
ADD COLUMN stock_comprometido DECIMAL(12, 4) DEFAULT 0.0;

-- 2. Soporte para Bloqueo Optimista (@Version)
-- Evita Race Conditions en transacciones críticas
ALTER TABLE ordenes_compra ADD COLUMN version INT DEFAULT 0;
ALTER TABLE transferencias ADD COLUMN version INT DEFAULT 0;

-- 3. Trazabilidad de Resoluciones (Anulaciones/Rechazos)
-- Campos comunes para auditoría de documentos liquidados

-- Para Compras
ALTER TABLE ordenes_compra ADD COLUMN motivo_resolucion TEXT;
ALTER TABLE ordenes_compra ADD COLUMN resuelto_por_id BIGINT REFERENCES usuario(id);
ALTER TABLE ordenes_compra ADD COLUMN fecha_resolucion TIMESTAMP;

-- Para Traslados
ALTER TABLE transferencias ADD COLUMN motivo_resolucion TEXT;
ALTER TABLE transferencias ADD COLUMN resuelto_por_id BIGINT REFERENCES usuario(id);
ALTER TABLE transferencias ADD COLUMN fecha_resolucion TIMESTAMP;

COMMENT ON COLUMN inventario_local.stock_comprometido IS 'Mercancía reservada por traslados pendientes que aún no han sido despachados físicamente.';
