-- Anular un pago equivocado (contra-asiento). El pago no se borra ni se edita: se marca como anulado con quién, cuándo
-- y por qué, y deja de contar en lo pagado. Los cuatro datos van juntos: o el pago está vigente (todos nulos) o anulado.
--
-- Se puede repetir sin fallar: en producción las columnas llegaron a existir sin que Flyway registrara esta versión, y
-- el arranque se caía con «column anulado_en already exists». (validate-on-migrate está desactivado, así que el cambio
-- de checksum no afecta a las bases donde V9 ya quedó registrada.)

ALTER TABLE public.pagos_orden_compra
    ADD COLUMN IF NOT EXISTS anulado_en timestamp without time zone,
    ADD COLUMN IF NOT EXISTS anulado_por_id bigint,
    ADD COLUMN IF NOT EXISTS anulado_por_nombre character varying(150),
    ADD COLUMN IF NOT EXISTS motivo_anulacion character varying(255);

ALTER TABLE public.pagos_traslado
    ADD COLUMN IF NOT EXISTS anulado_en timestamp without time zone,
    ADD COLUMN IF NOT EXISTS anulado_por_id bigint,
    ADD COLUMN IF NOT EXISTS anulado_por_nombre character varying(150),
    ADD COLUMN IF NOT EXISTS motivo_anulacion character varying(255);

-- PostgreSQL no tiene ADD CONSTRAINT IF NOT EXISTS: se agregan solo si faltan.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_orden_compra_anulado_por_fkey') THEN
        ALTER TABLE public.pagos_orden_compra
            ADD CONSTRAINT pagos_orden_compra_anulado_por_fkey FOREIGN KEY (anulado_por_id) REFERENCES public.usuario (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_orden_compra_anulacion_completa') THEN
        ALTER TABLE public.pagos_orden_compra
            ADD CONSTRAINT pagos_orden_compra_anulacion_completa CHECK (
                (anulado_en IS NULL AND anulado_por_id IS NULL AND motivo_anulacion IS NULL)
                OR (anulado_en IS NOT NULL AND anulado_por_id IS NOT NULL AND motivo_anulacion IS NOT NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_traslado_anulado_por_fkey') THEN
        ALTER TABLE public.pagos_traslado
            ADD CONSTRAINT pagos_traslado_anulado_por_fkey FOREIGN KEY (anulado_por_id) REFERENCES public.usuario (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_traslado_anulacion_completa') THEN
        ALTER TABLE public.pagos_traslado
            ADD CONSTRAINT pagos_traslado_anulacion_completa CHECK (
                (anulado_en IS NULL AND anulado_por_id IS NULL AND motivo_anulacion IS NULL)
                OR (anulado_en IS NOT NULL AND anulado_por_id IS NOT NULL AND motivo_anulacion IS NOT NULL));
    END IF;
END $$;
