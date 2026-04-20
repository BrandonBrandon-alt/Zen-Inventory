-- ============================================================
-- V16: Restaurar nombres reales en registros históricos
-- ============================================================

-- 1. Actualizar nombres de sucursal desde la tabla sucursal
UPDATE ventas v
SET sucursal_nombre = s.nombre
FROM sucursal s
WHERE v.sucursal_id = s.id
  AND (v.sucursal_nombre IS NULL OR v.sucursal_nombre LIKE 'Sucursal #%');

-- 2. Actualizar nombres de vendedores desde la tabla usuario
UPDATE ventas v
SET vendedor_nombre = u.nombre
FROM usuario u
WHERE v.usuario_id = u.id
  AND (v.vendedor_nombre IS NULL OR v.vendedor_nombre LIKE 'Usuario #%');

-- 3. Actualizar nombres de productos desde la tabla producto
UPDATE detalles_venta dv
SET producto_nombre = p.nombre
FROM producto p
WHERE dv.producto_id = p.id
  AND (dv.producto_nombre IS NULL OR dv.producto_nombre LIKE 'Producto #%');
