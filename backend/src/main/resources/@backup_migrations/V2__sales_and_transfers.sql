CREATE TABLE ventas (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12, 2) NOT NULL,
    sucursal_id BIGINT NOT NULL REFERENCES sucursal(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id)
);

CREATE TABLE detalles_venta (
    id BIGSERIAL PRIMARY KEY,
    venta_id BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    cantidad INT NOT NULL,
    precio_unitario_aplicado DECIMAL(12, 2) NOT NULL
);

CREATE TABLE transferencias (
    id BIGSERIAL PRIMARY KEY,
    estado VARCHAR(30) NOT NULL,
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_estimada_llegada TIMESTAMP,
    fecha_real_llegada TIMESTAMP,
    sucursal_origen_id BIGINT NOT NULL REFERENCES sucursal(id),
    sucursal_destino_id BIGINT NOT NULL REFERENCES sucursal(id)
);

CREATE TABLE detalles_transferencia (
    id BIGSERIAL PRIMARY KEY,
    transferencia_id BIGINT NOT NULL REFERENCES transferencias(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES producto(id),
    cantidad_solicitada INT NOT NULL,
    cantidad_enviada INT NOT NULL DEFAULT 0,
    cantidad_recibida INT NOT NULL DEFAULT 0,
    faltantes INT NOT NULL DEFAULT 0
);
