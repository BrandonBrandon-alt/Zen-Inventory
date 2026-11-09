/** Formas de pago de una venta; las comparten Ventas y Reportes (el cierre de caja se cuadra por forma de pago). */
export const SALE_PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'] as const;
export type SalePaymentMethod = (typeof SALE_PAYMENT_METHODS)[number];

export const isPaymentMethod = (value: unknown): value is SalePaymentMethod => (SALE_PAYMENT_METHODS as readonly unknown[]).includes(value);

export const PAYMENT_METHOD_LABELS: Readonly<Record<SalePaymentMethod, string>> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
};

/** Forma de pago de una venta; las anteriores al registro no la tienen. */
export const paymentLabel = (method: string | null): string => (isPaymentMethod(method) ? PAYMENT_METHOD_LABELS[method] : 'Sin registrar');
