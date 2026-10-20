-- Forma de pago de la venta (efectivo, tarjeta, transferencia u otro) y una referencia opcional (n.º de voucher o de
-- transferencia). Las ventas anteriores quedan en NULL («sin registrar»): no hay manera de saber cómo se pagaron.
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS metodo_pago character varying(20);
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS referencia_pago character varying(100);

CREATE INDEX IF NOT EXISTS idx_ventas_metodo_pago ON public.ventas (metodo_pago);
