-- ============================================================
-- V4: Datos de prueba iniciales (Seed Data)
-- NOTA: Las contraseñas son BCrypt de "admin123", "gerente123" y "operador123"
-- ============================================================

-- --------------------------------------------------------
-- Sucursales
-- --------------------------------------------------------
INSERT INTO sucursal (nombre, direccion, telefono, activa) VALUES
    ('Sede Central', 'Calle 10 # 5-20, Bogotá', '6017001001', true),
    ('Sucursal Norte', 'Av. 15 # 120-33, Bogotá', '6017002002', true),
    ('Sucursal Sur', 'Carrera 30 # 2-10, Bogotá', '6017003003', true);

-- --------------------------------------------------------
-- Usuarios (rol_id: 1=ADMIN, 2=GERENTE_SUCURSAL, 3=OPERADOR_INVENTARIO)
-- --------------------------------------------------------
-- Contraseñas: admin123 / gerente123 / operador123 (BCrypt rounds=10, $2b$ compatible con Spring Security)
INSERT INTO usuario (nombre, email, password_hash, rol_id, sucursal_id) VALUES
    ('Administrador Principal', 'admin@zeninventory.co',
     '$2b$10$LNaiRfIKHhv9WnSFBUQtROubYChmc/d5W6s7eAZzGjlEyO.mTmWCS', 1, 1),
    ('Gerente Norte', 'gerente@zeninventory.co',
     '$2b$10$O5JWPAEBEE.dpBKzOf4/XOjqz13DUg5t35zl4hYgtHHrGneOsOqj6', 2, 2),
    ('Operador Central', 'operador@zeninventory.co',
     '$2b$10$FDEIEVrwkQ6Hq.SxkRlBIe452C4VGAKHVrEfy7TCAXOkm//A1e.Sm', 3, 1);


-- --------------------------------------------------------
-- Proveedores
-- --------------------------------------------------------
INSERT INTO proveedor (nombre, contacto, tiempo_entrega_dias) VALUES
    ('Cementos Argos S.A.', 'ventas@argos.com.co', 3),
    ('Ferretería La Paloma', 'contacto@lapaloma.com', 1),
    ('Distribuidora Nacional', 'pedidos@disnacional.com', 5);

-- --------------------------------------------------------
-- Productos
-- --------------------------------------------------------
INSERT INTO producto (sku, nombre, costo_promedio, precio_venta, proveedor_id) VALUES
    ('CEM-GRI-50', 'Cemento Gris 50Kg', 28500.00, 34000.00, 1),
    ('VAR-3/8-6M', 'Varilla 3/8 x 6m',  12000.00, 15500.00, 2),
    ('AZU-BLA-30', 'Azulejo Blanco 30x30', 1800.00, 2400.00, 3),
    ('ARE-LAV-BL', 'Arena Lavada Bulto',  4500.00,  6000.00, 1),
    ('GRA-TRI-BL', 'Gravilla Triturada Bulto', 5200.00, 7000.00, 1);

-- --------------------------------------------------------
-- Unidades de Medida
-- --------------------------------------------------------
INSERT INTO unidad_medida (nombre, abreviatura) VALUES
    ('Unidad',  'UND'),
    ('Kilogramo', 'KG'),
    ('Bulto',   'BTO'),
    ('Litro',   'LT'),
    ('Metro',   'MT');

-- --------------------------------------------------------
-- Producto-Unidades (presentaciones)
-- --------------------------------------------------------
-- Cemento: base=Bulto, también se vende por Kg
INSERT INTO producto_unidad (producto_id, unidad_id, factor_conversion, es_base) VALUES
    (1, 3, 1.0000, true),   -- Cemento - Bulto (BASE)
    (1, 2, 0.0200, false),  -- Cemento - Kg (1 Bto = 50 Kg → 1 Kg = 0.02 Bto)
    (2, 1, 1.0000, true),   -- Varilla - Unidad (BASE)
    (3, 1, 1.0000, true),   -- Azulejo - Unidad (BASE)
    (4, 3, 1.0000, true),   -- Arena - Bulto (BASE)
    (5, 3, 1.0000, true);   -- Gravilla - Bulto (BASE)

-- --------------------------------------------------------
-- Inventario Local (stock inicial de productos en sucursales)
-- --------------------------------------------------------
INSERT INTO inventario_local (sucursal_id, producto_id, cantidad_actual, stock_minimo) VALUES
    -- Sede Central
    (1, 1, 200.0000, 20.0000),  -- 200 bultos cemento, mínimo 20
    (1, 2, 150.0000, 15.0000),  -- 150 varillas
    (1, 3, 500.0000, 50.0000),  -- 500 azulejos
    (1, 4, 80.0000,  10.0000),  -- 80 bultos arena
    (1, 5, 60.0000,  10.0000),  -- 60 bultos gravilla
    -- Sucursal Norte
    (2, 1, 50.0000,  10.0000),
    (2, 2, 30.0000,  5.0000),
    (2, 4, 20.0000,  5.0000),
    -- Sucursal Sur
    (3, 1, 40.0000,  10.0000),
    (3, 3, 100.0000, 20.0000);

-- --------------------------------------------------------
-- Rutas Logísticas entre sucursales
-- --------------------------------------------------------
INSERT INTO rutas_logisticas (sucursal_origen_id, sucursal_destino_id, tiempo_estimado_horas, costo_flete_estimado) VALUES
    (1, 2, 2, 45000.00),   -- Central → Norte
    (1, 3, 3, 60000.00),   -- Central → Sur
    (2, 1, 2, 45000.00),   -- Norte → Central
    (2, 3, 4, 80000.00),   -- Norte → Sur
    (3, 1, 3, 60000.00),   -- Sur → Central
    (3, 2, 4, 80000.00);   -- Sur → Norte
