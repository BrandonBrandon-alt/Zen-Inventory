-- ============================================================
-- V3: Alertas de prueba para validación de flujos
-- ============================================================

-- Se puede repetir: cada alerta de ejemplo se inserta solo si no existe ya.
INSERT INTO alertas_stock (sucursal_id, producto_id, mensaje, fecha_alerta, resuelta, tipo_alerta)
SELECT v.sucursal_id, v.producto_id, v.mensaje, v.fecha_alerta, false, 'LOW_STOCK'
FROM (VALUES
    (1, 1, 'Stock crítico: Cemento Gris 50Kg (Sede Central)', NOW()),
    (2, 2, 'Stock bajo: Varilla 3/8 x 6m (Sucursal Norte)', NOW() - INTERVAL '1 hour')
) AS v (sucursal_id, producto_id, mensaje, fecha_alerta)
WHERE NOT EXISTS (SELECT 1 FROM alertas_stock a WHERE a.sucursal_id = v.sucursal_id AND a.producto_id = v.producto_id AND a.mensaje = v.mensaje);
