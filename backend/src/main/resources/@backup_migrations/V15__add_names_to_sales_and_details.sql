-- ============================================================
-- V15: Nombres de Sucursal, Vendedor y Producto en Ventas
-- ============================================================

-- 1. Agregar nombres a la tabla de ventas (Snapshot de cabecera)
ALTER TABLE ventas ADD COLUMN sucursal_nombre VARCHAR(100);
ALTER TABLE ventas ADD COLUMN vendedor_nombre VARCHAR(100);

-- 2. Agregar nombre a la tabla de detalles (Snapshot de producto)
ALTER TABLE detalles_venta ADD COLUMN producto_nombre VARCHAR(200);

-- 3. Poblar datos existentes (Opcional, pero recomendado para consistencia)
-- Dado que no tenemos joins fáciles en una migración SQL simple sin subconsultas complejas, 
-- los registros antiguos quedarán como NULL o podemos poner un valor por defecto.
UPDATE ventas SET sucursal_nombre = 'Sucursal #' || sucursal_id, vendedor_nombre = 'Usuario #' || usuario_id WHERE sucursal_nombre IS NULL;
UPDATE detalles_venta SET producto_nombre = 'Producto #' || producto_id WHERE producto_nombre IS NULL;
