-- ============================================================
-- V3: Dominio Comercial (Compras) + Logística + Alertas Stock
-- ============================================================

-- --------------------------------------------------------
-- DOMINIO COMERCIAL: Órdenes de Compra a Proveedores
-- --------------------------------------------------------

CREATE TABLE ordenes_compra (
    id                      BIGSERIAL PRIMARY KEY,
    estado                  VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    -- PENDIENTE, EN_TRANSITO, RECIBIDA, CANCELADA
    fecha_solicitud         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_estimada_llegada  TIMESTAMP,
    proveedor_id            BIGINT NOT NULL REFERENCES proveedor(id),
    usuario_id              BIGINT NOT NULL REFERENCES usuario(id)
);

CREATE TABLE detalles_compra (
    id                  BIGSERIAL PRIMARY KEY,
    orden_compra_id     BIGINT NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    producto_id         BIGINT NOT NULL REFERENCES producto(id),
    cantidad            DECIMAL(12, 4) NOT NULL,
    precio_unitario     DECIMAL(12, 2) NOT NULL
);

-- --------------------------------------------------------
-- DOMINIO LOGÍSTICO: Rutas entre Sucursales
-- --------------------------------------------------------

CREATE TABLE rutas_logisticas (
    id                      BIGSERIAL PRIMARY KEY,
    sucursal_origen_id      BIGINT NOT NULL REFERENCES sucursal(id),
    sucursal_destino_id     BIGINT NOT NULL REFERENCES sucursal(id),
    tiempo_estimado_horas   INT DEFAULT 0,
    costo_flete_estimado    DECIMAL(12, 2) DEFAULT 0.0,
    UNIQUE(sucursal_origen_id, sucursal_destino_id)
);

-- --------------------------------------------------------
-- VALOR AGREGADO: Alertas de Ruptura de Stock Mínimo
-- --------------------------------------------------------

CREATE TABLE alertas_stock (
    id          BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    mensaje     TEXT NOT NULL,
    fecha_alerta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resuelta    BOOLEAN NOT NULL DEFAULT FALSE
);
