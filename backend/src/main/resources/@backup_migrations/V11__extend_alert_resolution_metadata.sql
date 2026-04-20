-- Agregamos las columnas para soportar el Gateway de Decisiones en las alertas

ALTER TABLE alertas_stock 
ADD COLUMN tipo_resolucion VARCHAR(50); -- Ej: 'TRANSFER', 'PURCHASE', 'DISMISSED'

ALTER TABLE alertas_stock 
ADD COLUMN referencia_id BIGINT; -- Guardará el ID de la Transferencia o de la Orden de Compra

ALTER TABLE alertas_stock 
ADD COLUMN motivo_descarte TEXT; -- Justificación si se elige ignorar/descartar

ALTER TABLE alertas_stock 
ADD COLUMN fecha_resolucion TIMESTAMP;
