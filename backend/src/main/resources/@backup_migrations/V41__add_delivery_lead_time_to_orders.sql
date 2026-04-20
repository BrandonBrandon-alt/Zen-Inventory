-- ============================================================
-- V41: Añadir Plazo de Entrega en Días a Órdenes de Compra
-- ============================================================

ALTER TABLE ordenes_compra 
ADD COLUMN tiempo_entrega_dias INTEGER DEFAULT 3;

COMMENT ON COLUMN ordenes_compra.tiempo_entrega_dias IS 'Plazo acordado en días para la entrega del pedido por parte del proveedor.';
