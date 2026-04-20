-- ============================================================
-- V20: Columnas para Gestión de Plazos de Pago en Compras
-- ============================================================

ALTER TABLE ordenes_compra
  ADD COLUMN fecha_vencimiento_pago TIMESTAMP,
  ADD COLUMN plazo_pago_dias INT NOT NULL DEFAULT 30;

CREATE INDEX idx_orden_vencimiento ON ordenes_compra(fecha_vencimiento_pago);
