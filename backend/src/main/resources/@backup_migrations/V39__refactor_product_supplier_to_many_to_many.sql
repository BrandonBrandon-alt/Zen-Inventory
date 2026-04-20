-- ============================================================
-- V39: Refactor Many-to-Many entre Productos y Proveedores
-- ============================================================

-- 1. Crear la tabla de relación (Junction Table / Catálogo de Proveedores)
CREATE TABLE producto_proveedor (
    id BIGSERIAL PRIMARY KEY,
    producto_id BIGINT NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    proveedor_id BIGINT NOT NULL REFERENCES proveedor(id) ON DELETE CASCADE,
    
    sku_proveedor VARCHAR(100), -- Referencia interna del proveedor
    precio_pactado DECIMAL(12, 2) DEFAULT 0.00,
    tiempo_entrega_dias INT DEFAULT 0,
    
    preferido BOOLEAN DEFAULT FALSE, -- Indica si es el proveedor recomendado
    UNIQUE(producto_id, proveedor_id)
);

-- 2. Migrar los datos existentes de la tabla producto
-- Copiamos el proveedor_id actual, el costo promedio como precio pactado
-- y traemos el tiempo de entrega base del proveedor si existía.
INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_pactado, tiempo_entrega_dias, preferido)
SELECT 
    p.id, 
    p.proveedor_id, 
    p.costo_promedio, 
    COALESCE(pr.tiempo_entrega_dias, 0),
    TRUE
FROM producto p
INNER JOIN proveedor pr ON p.proveedor_id = pr.id;

-- 3. Eliminar la columna redundante de la tabla producto
ALTER TABLE producto DROP COLUMN proveedor_id;
