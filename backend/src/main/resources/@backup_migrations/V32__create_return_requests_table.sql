-- ============================================================
-- V32: Implementación del Módulo de Devoluciones Jerárquicas
-- ============================================================

-- 1. Cabecera de la Solicitud de Devolución
CREATE TABLE solicitudes_devolucion (
    id                      BIGSERIAL PRIMARY KEY,
    venta_id               BIGINT NOT NULL REFERENCES ventas(id),
    sucursal_id            BIGINT NOT NULL REFERENCES sucursal(id),
    solicitante_id         BIGINT NOT NULL REFERENCES usuario(id),
    aprobador_id           BIGINT REFERENCES usuario(id), -- Null hasta que se apruebe/rechace
    
    estado                 VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', 
    -- PENDIENTE, APROBADA, RECHAZADA
    
    fecha_solicitud        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_procesamiento    TIMESTAMP, -- Cuando se aprueba o rechaza
    
    motivo_general         TEXT NOT NULL,
    comentario_aprobador   TEXT,
    
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Detalles de la Solicitud (Ítems específicos a devolver)
CREATE TABLE detalles_devolucion_solicitud (
    id                  BIGSERIAL PRIMARY KEY,
    solicitud_id        BIGINT NOT NULL REFERENCES solicitudes_devolucion(id) ON DELETE CASCADE,
    producto_id         BIGINT NOT NULL REFERENCES producto(id),
    
    cantidad            INT NOT NULL, -- Cantidad parcial solicitada
    motivo_especifico   TEXT,         -- Ej: 'Empaque roto'
    precio_unidad_venta  DECIMAL(12, 2) NOT NULL -- Precio al que se vendió originalmente
);

-- Índices para optimizar búsquedas por estado y auditoría
CREATE INDEX idx_return_status ON solicitudes_devolucion(estado);
CREATE INDEX idx_return_branch ON solicitudes_devolucion(sucursal_id);
CREATE INDEX idx_return_sale ON solicitudes_devolucion(venta_id);
