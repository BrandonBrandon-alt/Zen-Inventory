-- Pagos del flete de un traslado. Antes solo se anotaba el costo del envío al despachar; no había forma de registrar que
-- se le pagó al transportista, cuánto, cuándo, quién ni cómo. Cada fila es un pago (o abono) y es inmutable.
-- Los traslados ya despachados quedan «por pagar»: no consta que se hayan pagado, así que no se inventan pagos.
CREATE TABLE IF NOT EXISTS public.pagos_traslado
(
    id bigserial NOT NULL,
    traslado_id bigint NOT NULL,
    monto numeric(12, 2) NOT NULL,
    fecha timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id bigint NOT NULL,
    usuario_nombre character varying(150) NOT NULL,
    metodo character varying(30) NOT NULL,
    referencia character varying(100),
    notas text,
    CONSTRAINT pagos_traslado_pkey PRIMARY KEY (id),
    CONSTRAINT pagos_traslado_monto_check CHECK (monto > 0),
    CONSTRAINT pagos_traslado_traslado_fkey FOREIGN KEY (traslado_id) REFERENCES public.transferencias (id),
    CONSTRAINT pagos_traslado_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario (id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_traslado_traslado ON public.pagos_traslado (traslado_id);
