-- ============================================================
-- V3: Alertas de prueba para validación de flujos
-- ============================================================

INSERT INTO alertas_stock (sucursal_id, producto_id, mensaje, fecha_alerta, resuelta, tipo_alerta) VALUES
    (1, 1, 'Stock crítico: Cemento Gris 50Kg (Sede Central)', NOW(), false, 'LOW_STOCK'),
    (2, 2, 'Stock bajo: Varilla 3/8 x 6m (Sucursal Norte)', NOW() - INTERVAL '1 hour', false, 'LOW_STOCK');
