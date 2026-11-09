-- Registro de pagos de las órdenes de compra. Antes el pago era solo un cambio de estado: no quedaba cuánto, cuándo,
-- quién ni cómo se pagó, y no se podían registrar abonos. Cada fila es un pago (o abono) y es inmutable.
CREATE TABLE IF NOT EXISTS public.pagos_orden_compra
(
    id bigserial NOT NULL,
    orden_id bigint NOT NULL,
    monto numeric(12, 2) NOT NULL,
    fecha timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id bigint NOT NULL,
    usuario_nombre character varying(150) NOT NULL,
    metodo character varying(30) NOT NULL,
    referencia character varying(100),
    notas text,
    CONSTRAINT pagos_orden_compra_pkey PRIMARY KEY (id),
    CONSTRAINT pagos_orden_compra_monto_check CHECK (monto > 0),
    CONSTRAINT pagos_orden_compra_orden_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_compra (id),
    CONSTRAINT pagos_orden_compra_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario (id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_orden_compra_orden ON public.pagos_orden_compra (orden_id);

-- Las órdenes que ya estaban pagadas conservan su historia: un pago por el total, atribuido a quien creó la orden.
INSERT INTO public.pagos_orden_compra (orden_id, monto, fecha, usuario_id, usuario_nombre, metodo, notas)
SELECT o.id, o.total, COALESCE(o.fecha_resolucion, o.fecha_real_llegada, o.fecha_solicitud), o.usuario_id,
       COALESCE(u.nombre, 'Desconocido'), 'OTRO', 'Pago anterior al registro de pagos'
FROM public.ordenes_compra o
LEFT JOIN public.usuario u ON u.id = o.usuario_id
WHERE o.estado_pago = 'PAGADO' AND o.total > 0
  AND NOT EXISTS (SELECT 1 FROM public.pagos_orden_compra p WHERE p.orden_id = o.id);

-- Un «pago parcial» sin ningún pago registrado no se puede respaldar: no se sabe cuánto se abonó. Vuelve a «por pagar»
-- para que el estado coincida con lo que realmente consta.
UPDATE public.ordenes_compra o
SET estado_pago = 'POR_PAGAR'
WHERE o.estado_pago = 'PAGO_PARCIAL'
  AND NOT EXISTS (SELECT 1 FROM public.pagos_orden_compra p WHERE p.orden_id = o.id);
