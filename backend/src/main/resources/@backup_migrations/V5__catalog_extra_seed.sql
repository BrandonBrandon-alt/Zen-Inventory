-- V2: Datos semilla del catálogo de productos
-- Los proveedores y productos ya tienen su tabla en V1 (schema inicial).
-- Esta migración agrega registros base para pruebas y desarrollo.

INSERT INTO proveedor (nombre, contacto, tiempo_entrega_dias) VALUES
    ('Distribuidora Nacional S.A.', 'contacto@distnacional.co', 5),
    ('Importaciones Globales Ltda.', 'ventas@importglobal.co', 15),
    ('Proveedor Local Express', 'pedidos@localexpress.co', 2);

INSERT INTO producto (sku, nombre, costo_promedio, precio_venta, proveedor_id) VALUES
    ('PROD-001', 'Arroz Blanco 500g',    2500.00,  3800.00, 1),
    ('PROD-002', 'Aceite Vegetal 1L',    8000.00, 12000.00, 1),
    ('PROD-003', 'Café Molido 250g',    12000.00, 18500.00, 2),
    ('PROD-004', 'Sal Marina 1kg',       1500.00,  2500.00, 3),
    ('PROD-005', 'Azúcar Refinada 1kg',  2800.00,  4200.00, 1);
