-- ============================================================
-- V21: Columna de Descuento por Item en Compras
-- ============================================================

ALTER TABLE detalles_orden_compra
  ADD COLUMN descuento_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00;
