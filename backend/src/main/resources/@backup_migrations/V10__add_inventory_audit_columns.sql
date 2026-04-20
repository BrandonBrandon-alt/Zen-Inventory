-- Agregar unidad de medida al catálogo de productos
ALTER TABLE producto ADD COLUMN unidad VARCHAR(20) DEFAULT 'UNIDADES';

-- Agregar saldo final al historial de movimientos para auditoría (Kardex)
ALTER TABLE movimiento_inventario ADD COLUMN saldo_final DECIMAL(12, 2) DEFAULT 0;

-- Actualizar registros existentes para tener coherencia inicial (opcional)
UPDATE movimiento_inventario SET saldo_final = cantidad;
