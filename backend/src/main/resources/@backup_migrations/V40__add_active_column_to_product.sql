-- V40__add_active_column_to_product.sql
-- Implementación de Soft-Delete (Desactivación) para productos.
-- Esto permite mantener la integridad referencial con el historial de compras e inventario.

ALTER TABLE producto ADD COLUMN activa BOOLEAN DEFAULT TRUE;
