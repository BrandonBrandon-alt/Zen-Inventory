-- V19: Crear sistema de listas de precios
-- Tabla maestra de listas de precios
CREATE TABLE lista_precios (
    id          BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    activa      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Tabla asociativa: precio de un producto en una lista específica
-- Si un producto no tiene fila aquí para una lista, el sistema usa precio_venta del producto
CREATE TABLE precio_por_lista (
    id          BIGSERIAL PRIMARY KEY,
    lista_id    BIGINT NOT NULL REFERENCES lista_precios(id) ON DELETE CASCADE,
    producto_id BIGINT NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    precio      NUMERIC(12, 2) NOT NULL CHECK (precio > 0),
    CONSTRAINT uq_lista_producto UNIQUE (lista_id, producto_id)
);

-- Seed: Listas de precios por defecto del negocio
INSERT INTO lista_precios (nombre, descripcion) VALUES
    ('Minorista', 'Precio estándar al público general'),
    ('Mayorista', 'Precio preferencial para compras por volumen'),
    ('Especial',  'Precio para clientes VIP o contratos negociados');
