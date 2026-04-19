-- Adición de fecha de despacho a cabecera de transferencias
ALTER TABLE transferencias ADD COLUMN fecha_despacho TIMESTAMP;

-- Adición de nombre de producto a detalles para auditoría y visualización rápida
ALTER TABLE detalles_transferencia ADD COLUMN producto_nombre VARCHAR(255);

-- BACKFILL: Llenar nombres de productos para registros existentes
UPDATE detalles_transferencia dt
SET producto_nombre = p.nombre
FROM producto p
WHERE dt.producto_id = p.id;
