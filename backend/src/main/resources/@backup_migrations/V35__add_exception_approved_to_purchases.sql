-- Migración para añadir soporte a aprobación de excepciones en órdenes de compra
ALTER TABLE ordenes_compra ADD COLUMN excepcion_aprobada BOOLEAN NOT NULL DEFAULT FALSE;
