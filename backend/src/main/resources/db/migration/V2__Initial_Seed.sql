-- ===================================================================================
-- Migración: Datos de inicialización (Seed Data) Consolidado - Zen Inventory
-- NOTA: Las contraseñas son BCrypt de "admin123", "gerente123" y "operador123"
-- ===================================================================================

BEGIN;

-- --------------------------------------------------------
-- 1. Roles
-- --------------------------------------------------------
INSERT INTO rol (id, nombre) VALUES 
    (1, 'ADMIN'), 
    (2, 'MANAGER'), 
    (3, 'OPERADOR_INVENTARIO'),
    (4, 'SELLER')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 2. Unidades de Medida
-- --------------------------------------------------------
INSERT INTO unidad_medida (id, nombre, abreviatura) VALUES
    (1, 'Unidad',  'UND'),
    (2, 'Kilogramo', 'KG'),
    (3, 'Bulto',   'BTO'),
    (4, 'Litro',   'LT'),
    (5, 'Metro',   'MT')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 3. Sucursales
-- --------------------------------------------------------
INSERT INTO sucursal (id, nombre, direccion, telefono, activa) VALUES
    (1, 'Sede Central', 'Calle 10 # 5-20, Bogotá', '6017001001', true),
    (2, 'Sucursal Norte', 'Av. 15 # 120-33, Bogotá', '6017002002', true),
    (3, 'Sucursal Sur', 'Carrera 30 # 2-10, Bogotá', '6017003003', true)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- Usuarios (rol_id: 1=ADMIN, 2=MANAGER, 3=OPERADOR_INVENTARIO, 4=SELLER)
-- --------------------------------------------------------
INSERT INTO usuario (id, nombre, email, password_hash, rol_id, sucursal_id, activa) VALUES
    (1, 'Administrador Principal', 'admin@zeninventory.co',
     '$2b$10$LNaiRfIKHhv9WnSFBUQtROubYChmc/d5W6s7eAZzGjlEyO.mTmWCS', 1, 1, true),
    (2, 'Gerente Norte', 'gerente@zeninventory.co',
     '$2b$10$O5JWPAEBEE.dpBKzOf4/XOjqz13DUg5t35zl4hYgtHHrGneOsOqj6', 2, 2, true),
    (3, 'Operador Central', 'operador@zeninventory.co',
     '$2b$10$FDEIEVrwkQ6Hq.SxkRlBIe452C4VGAKHVrEfy7TCAXOkm//A1e.Sm', 3, 1, true)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 5. Proveedores
-- --------------------------------------------------------
INSERT INTO proveedor (id, nombre, contacto, tiempo_entrega_dias) VALUES
    (1, 'Cementos Argos S.A.', 'ventas@argos.com.co', 3),
    (2, 'Ferretería La Paloma', 'contacto@lapaloma.com', 1),
    (3, 'Distribuidora Nacional', 'pedidos@disnacional.com', 5)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 6. Productos 
-- --------------------------------------------------------
INSERT INTO producto (id, sku, nombre, costo_promedio, precio_venta, unidad_id, activa) VALUES
    (1, 'CEM-GRI-50', 'Cemento Gris 50Kg', 28500.00, 34000.00, 3, true),
    (2, 'VAR-3/8-6M', 'Varilla 3/8 x 6m',  12000.00, 15500.00, 1, true),
    (3, 'AZU-BLA-30', 'Azulejo Blanco 30x30', 1800.00, 2400.00, 1, true),
    (4, 'ARE-LAV-BL', 'Arena Lavada Bulto',  4500.00,  6000.00, 3, true),
    (5, 'GRA-TRI-BL', 'Gravilla Triturada Bulto', 5200.00, 7000.00, 3, true)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 7. Relación Producto-Proveedor (N:M)
-- --------------------------------------------------------
INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_pactado, tiempo_entrega_dias, preferido) VALUES
    (1, 1, 28000.00, 3, true),  -- Cemento -> Argos (Principal)
    (1, 2, 30000.00, 1, false), -- Cemento -> La Paloma (Respaldo rápido)
    (2, 2, 11500.00, 1, true),  -- Varilla -> La Paloma
    (3, 3, 1700.00, 5, true),   -- Azulejo -> Distribuidora
    (4, 1, 4000.00, 2, true),   -- Arena -> Argos
    (5, 1, 4800.00, 2, true)    -- Gravilla -> Argos
ON CONFLICT (producto_id, proveedor_id) DO NOTHING;

-- --------------------------------------------------------
-- 8. Producto-Unidades (Presentaciones)
-- --------------------------------------------------------
INSERT INTO producto_unidad (producto_id, unidad_id, factor_conversion, es_base) VALUES
    (1, 3, 1.0000, true),   -- Cemento - Bulto (BASE)
    (1, 2, 0.0200, false),  -- Cemento - Kg (1 Bto = 50 Kg)
    (2, 1, 1.0000, true),   -- Varilla - Unidad (BASE)
    (3, 1, 1.0000, true),   -- Azulejo - Unidad (BASE)
    (4, 3, 1.0000, true),   -- Arena - Bulto (BASE)
    (5, 3, 1.0000, true)    -- Gravilla - Bulto (BASE)
ON CONFLICT (producto_id, unidad_id) DO NOTHING;

-- --------------------------------------------------------
-- 9. Listas de Precios (Para el módulo de ventas)
-- --------------------------------------------------------
INSERT INTO lista_precios (id, nombre, descripcion, activa) VALUES 
    (1, 'Público General', 'Precio estándar de mostrador', true),
    (2, 'Constructor Mayorista', 'Precio para compras al por mayor', true),
    (3, 'VIP', 'Precio para clientes VIP', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO precio_por_lista (lista_id, producto_id, precio) VALUES 
    (1, 1, 34000.00), (2, 1, 31000.00), -- Cemento
    (1, 2, 15500.00), (2, 2, 14000.00), -- Varilla
    (1, 3, 2400.00),  (2, 3, 2100.00)   -- Azulejo
ON CONFLICT (lista_id, producto_id) DO NOTHING;

-- --------------------------------------------------------
-- 10. Inventario Local (Datos Estratégicos para la Demo)
-- --------------------------------------------------------
INSERT INTO inventario_local (sucursal_id, producto_id, cantidad_actual, stock_minimo, stock_comprometido) VALUES 
    -- SEDE CENTRAL (ID 1) -> Donde entra el admin
    (1, 1, 500.00, 50.00, 0.00),  -- OK: Cemento bien stockeado
    (1, 2, 10.00, 30.00, 0.00),   -- ALERTA: Varilla baja (10/30)
    (1, 3, 0.00, 50.00, 0.00),    -- CRÍTICO: Azulejo sin stock (0/50)
    
    -- SUCURSAL NORTE (ID 2) -> Bodega de respaldo
    (2, 2, 800.00, 50.00, 0.00),  -- Tiene mucha Varilla (Ideal para mostrar un traslado hacia la Sede Central)
    (2, 3, 1000.00, 100.00, 0.00) -- Tiene mucho Azulejo
ON CONFLICT (sucursal_id, producto_id) DO NOTHING;

-- --------------------------------------------------------
-- 11. Rutas Logísticas
-- --------------------------------------------------------
INSERT INTO rutas_logisticas (sucursal_origen_id, sucursal_destino_id, tiempo_estimado_horas, costo_flete_estimado) VALUES
    (1, 2, 2, 45000.00),
    (1, 3, 3, 60000.00),
    (2, 1, 2, 45000.00),
    (2, 3, 4, 80000.00),
    (3, 1, 3, 60000.00),
    (3, 2, 4, 80000.00)
ON CONFLICT (sucursal_origen_id, sucursal_destino_id) DO NOTHING;

-- --------------------------------------------------------
-- 12. Sincronización de Secuencias (Para evitar errores de IDs)
-- --------------------------------------------------------
SELECT setval('rol_id_seq', (SELECT MAX(id) FROM rol));
SELECT setval('unidad_medida_id_seq', (SELECT MAX(id) FROM unidad_medida));
SELECT setval('sucursal_id_seq', (SELECT MAX(id) FROM sucursal));
SELECT setval('usuario_id_seq', (SELECT MAX(id) FROM usuario));
SELECT setval('proveedor_id_seq', (SELECT MAX(id) FROM proveedor));
SELECT setval('producto_id_seq', (SELECT MAX(id) FROM producto));
SELECT setval('lista_precios_id_seq', (SELECT MAX(id) FROM lista_precios));
SELECT setval('producto_proveedor_id_seq', (SELECT MAX(id) FROM producto_proveedor));
SELECT setval('producto_unidad_id_seq', (SELECT MAX(id) FROM producto_unidad));
SELECT setval('precio_por_lista_id_seq', (SELECT MAX(id) FROM precio_por_lista));
SELECT setval('inventario_local_id_seq', (SELECT MAX(id) FROM inventario_local));
SELECT setval('rutas_logisticas_id_seq', (SELECT MAX(id) FROM rutas_logisticas));

COMMIT;