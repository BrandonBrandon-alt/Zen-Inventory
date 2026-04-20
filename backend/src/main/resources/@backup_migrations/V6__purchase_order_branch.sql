-- Añadimos la relación de sucursal a las órdenes de compra para trazar el ingreso de inventario
ALTER TABLE ordenes_compra ADD COLUMN sucursal_id BIGINT;
ALTER TABLE ordenes_compra ADD CONSTRAINT fk_orden_compra_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursal(id);
