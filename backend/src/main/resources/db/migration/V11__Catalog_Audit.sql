-- Auditoría del catálogo: cada campo que cambió en un producto (precio, costo, estado, proveedores, mínimo por
-- sucursal) o en un usuario (rol, sucursal, estado, creación), con el antes, el después, quién y cuándo.
-- El nombre de la entidad y el de quien hizo el cambio son una foto del momento: si después se renombran, la fila
-- sigue diciendo lo que se veía entonces.

CREATE TABLE IF NOT EXISTS public.cambio_catalogo
(
    id bigserial NOT NULL,
    fecha timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entidad character varying(20) NOT NULL,
    entidad_id bigint NOT NULL,
    entidad_nombre character varying(255) NOT NULL,
    campo character varying(255) NOT NULL,
    valor_anterior text,
    valor_nuevo text,
    usuario_id bigint,
    usuario_nombre character varying(255),
    CONSTRAINT cambio_catalogo_pkey PRIMARY KEY (id),
    CONSTRAINT cambio_catalogo_entidad_check CHECK (entidad IN ('PRODUCTO', 'USUARIO'))
);

CREATE INDEX IF NOT EXISTS idx_cambio_catalogo_fecha ON public.cambio_catalogo (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cambio_catalogo_entidad ON public.cambio_catalogo (entidad, entidad_id);
