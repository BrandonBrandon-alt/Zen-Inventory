-- ============================================================
-- V26: Añadir campos de Mánager a Sucursales
-- ============================================================

-- Añadimos la columna para referenciar al usuario mánager
ALTER TABLE sucursal ADD COLUMN manager_id BIGINT;

-- Establecemos la relación de llave foránea
-- Nota: On Delete Set Null para no borrar la sucursal si el usuario es eliminado
ALTER TABLE sucursal ADD CONSTRAINT fk_sucursal_manager FOREIGN KEY (manager_id) REFERENCES usuario(id) ON DELETE SET NULL;
