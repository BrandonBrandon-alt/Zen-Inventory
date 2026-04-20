-- ============================================================
-- V2: Datos de inicialización (Seed Data) Consolidado
-- NOTA: Las contraseñas son BCrypt de "admin123", "gerente123" y "operador123"
-- ============================================================

BEGIN;

-- --------------------------------------------------------
-- 1. Roles
-- --------------------------------------------------------
INSERT INTO rol (nombre) VALUES 
    ('ADMIN'), 
    ('GERENTE_SUCURSAL'), 
    ('OPERADOR_INVENTARIO');

-- --------------------------------------------------------
-- 2. Unidades de Medida (Requerido por Producto)
-- --------------------------------------------------------
INSERT INTO unidad_medida (nombre, abreviatura) VALUES
    ('Unidad',  'UND'),
    ('Kilogramo', 'KG'),
    ('Bulto',   'BTO'),
    ('Litro',   'LT'),
    ('Metro',   'MT');

-- --------------------------------------------------------
-- 3. Sucursales
-- --------------------------------------------------------
INSERT INTO sucursal (nombre, direccion, telefono, activa) VALUES
    ('Sede Central', 'Calle 10 # 5-20, Bogotá', '6017001001', true),
    ('Sucursal Norte', 'Av. 15 # 120-33, Bogotá', '6017002002', true),
    ('Sucursal Sur', 'Carrera 30 # 2-10, Bogotá', '6017003003', true);

-- --------------------------------------------------------
-- 4. Usuarios
-- --------------------------------------------------------
-- admin123 / gerente123 / operador123
INSERT INTO usuario (nombre, email, password_hash, rol_id, sucursal_id) VALUES
    ('Administrador Principal', 'admin@zeninventory.co',
     '$2b$10$LNaiRfIKHhv9WnSFBUQtROubYChmc/d5W6s7eAZzGjlEyO.mTmWCS', 1, 1),
    ('Gerente Norte', 'gerente@zeninventory.co',
     '$2b$10$O5JWPAEBEE.dpBKzOf4/XOjqz13DUg5t35zl4hYgtHHrGneOsOqj6', 2, 2),
    ('Operador Central', 'operador@zeninventory.co',
     '$2b$10$FDEIEVrwkQ6Hq.SxkRlBIe452C4VGAKHVrEfy7TCAXOkm//A1e.Sm', 3, 1);

-- --------------------------------------------------------
-- 5. Proveedores
-- --------------------------------------------------------
INSERT INTO proveedor (nombre, contacto, tiempo_entrega_dias) VALUES
    ('Cementos Argos S.A.', 'ventas@argos.com.co', 3),
    ('Ferretería La Paloma', 'contacto@lapaloma.com', 1),
    ('Distribuidora Nacional', 'pedidos@disnacional.com', 5);

-- --------------------------------------------------------
-- 6. Productos (Sin columna proveedor_id, usa unidad_id)
-- --------------------------------------------------------
INSERT INTO producto (sku, nombre, costo_promedio, precio_venta, unidad_id) VALUES
    ('CEM-GRI-50', 'Cemento Gris 50Kg', 28500.00, 34000.00, 3), -- Bulto
    ('VAR-3/8-6M', 'Varilla 3/8 x 6m',  12000.00, 15500.00, 1), -- Unidad
    ('AZU-BLA-30', 'Azulejo Blanco 30x30', 1800.00, 2400.00, 1), -- Unidad
    ('ARE-LAV-BL', 'Arena Lavada Bulto',  4500.00,  6000.00, 3), -- Bulto
    ('GRA-TRI-BL', 'Gravilla Triturada Bulto', 5200.00, 7000.00, 3); -- Bulto

-- --------------------------------------------------------
-- 7. Relación Producto-Proveedor (N:M)
-- --------------------------------------------------------
INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_pactado, tiempo_entrega_dias, preferido) VALUES
    (1, 1, 28000.00, 3, true), -- Cemento -> Argos
    (2, 2, 11500.00, 1, true), -- Varilla -> La Paloma
    (3, 3, 1700.00, 5, true),  -- Azulejo -> Distribuidora
    (4, 1, 4000.00, 2, true),  -- Arena -> Argos
    (5, 1, 4800.00, 2, true);  -- Gravilla -> Argos

-- --------------------------------------------------------
-- 8. Producto-Unidades (Presentaciones)
-- --------------------------------------------------------
INSERT INTO producto_unidad (producto_id, unidad_id, factor_conversion, es_base) VALUES
    (1, 3, 1.0000, true),   -- Cemento - Bulto (BASE)
    (1, 2, 0.0200, false),  -- Cemento - Kg (1 Bto = 50 Kg)
    (2, 1, 1.0000, true),   -- Varilla - Unidad (BASE)
    (3, 1, 1.0000, true),   -- Azulejo - Unidad (BASE)
    (4, 3, 1.0000, true),   -- Arena - Bulto (BASE)
    (5, 3, 1.0000, true);   -- Gravilla - Bulto (BASE)

-- --------------------------------------------------------
-- 9. Rutas Logísticas
-- --------------------------------------------------------
INSERT INTO rutas_logisticas (sucursal_origen_id, sucursal_destino_id, tiempo_estimado_horas, costo_flete_estimado) VALUES
    (1, 2, 2, 45000.00),
    (1, 3, 3, 60000.00),
    (2, 1, 2, 45000.00),
    (2, 3, 4, 80000.00),
    (3, 1, 3, 60000.00),
    (3, 2, 4, 80000.00);

COMMIT;
