-- ============================================================
-- V17: Sincronización Relacional de Unidades de Medida
-- Vincula la tabla producto con la tabla maestra unidad_medida
-- ============================================================

-- 1. Agregar la nueva columna de llave foránea
ALTER TABLE producto ADD COLUMN unidad_id BIGINT;

-- 2. Migración de datos existentes basado en el Enum antiguo
UPDATE producto 
SET unidad_id = (SELECT id FROM unidad_medida WHERE abreviatura = 'UND' LIMIT 1)
WHERE unidad = 'UNIDADES' OR unidad IS NULL;

UPDATE producto 
SET unidad_id = (SELECT id FROM unidad_medida WHERE abreviatura = 'KG' LIMIT 1)
WHERE unidad = 'KILOS';

UPDATE producto 
SET unidad_id = (SELECT id FROM unidad_medida WHERE abreviatura = 'LT' LIMIT 1)
WHERE unidad = 'LITROS';

UPDATE producto 
SET unidad_id = (SELECT id FROM unidad_medida WHERE abreviatura = 'MT' LIMIT 1)
WHERE unidad = 'METROS_CUADRADOS';

-- 3. Si quedó alguno sin mapear, asignar por defecto la primera unidad disponible (UND)
UPDATE producto 
SET unidad_id = (SELECT id FROM unidad_medida ORDER BY id ASC LIMIT 1)
WHERE unidad_id IS NULL;

-- 4. Establecer restricciones de integridad
ALTER TABLE producto ALTER COLUMN unidad_id SET NOT NULL;
ALTER TABLE producto ADD CONSTRAINT fk_producto_unidad_medida 
    FOREIGN KEY (unidad_id) REFERENCES unidad_medida(id);

-- 5. Eliminar la columna de texto antigua
ALTER TABLE producto DROP COLUMN unidad;
