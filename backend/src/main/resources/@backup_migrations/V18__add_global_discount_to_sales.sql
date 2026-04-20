-- V18: Añadir soporte para descuento global en ventas
ALTER TABLE ventas ADD COLUMN global_discount_percentage NUMERIC(5, 2) DEFAULT 0.00;

-- Asegurar que los registros existentes tengan 0.00
UPDATE ventas SET global_discount_percentage = 0.00 WHERE global_discount_percentage IS NULL;
