-- Anular un pago equivocado (contra-asiento). El pago no se borra ni se edita: se marca como anulado con quién, cuándo
-- y por qué, y deja de contar en lo pagado. Los cuatro datos van juntos: o el pago está vigente (todos nulos) o anulado.

ALTER TABLE public.pagos_orden_compra
    ADD COLUMN anulado_en timestamp without time zone,
    ADD COLUMN anulado_por_id bigint,
    ADD COLUMN anulado_por_nombre character varying(150),
    ADD COLUMN motivo_anulacion character varying(255),
    ADD CONSTRAINT pagos_orden_compra_anulado_por_fkey FOREIGN KEY (anulado_por_id) REFERENCES public.usuario (id),
    ADD CONSTRAINT pagos_orden_compra_anulacion_completa CHECK (
        (anulado_en IS NULL AND anulado_por_id IS NULL AND motivo_anulacion IS NULL)
        OR (anulado_en IS NOT NULL AND anulado_por_id IS NOT NULL AND motivo_anulacion IS NOT NULL));

ALTER TABLE public.pagos_traslado
    ADD COLUMN anulado_en timestamp without time zone,
    ADD COLUMN anulado_por_id bigint,
    ADD COLUMN anulado_por_nombre character varying(150),
    ADD COLUMN motivo_anulacion character varying(255),
    ADD CONSTRAINT pagos_traslado_anulado_por_fkey FOREIGN KEY (anulado_por_id) REFERENCES public.usuario (id),
    ADD CONSTRAINT pagos_traslado_anulacion_completa CHECK (
        (anulado_en IS NULL AND anulado_por_id IS NULL AND motivo_anulacion IS NULL)
        OR (anulado_en IS NOT NULL AND anulado_por_id IS NOT NULL AND motivo_anulacion IS NOT NULL));
