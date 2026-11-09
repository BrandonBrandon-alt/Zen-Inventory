/** Formas en que se paga a un proveedor (compras) o a un transportista (fletes de traslados). */
export const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const isPaymentMethod = (value: unknown): value is PaymentMethod => (PAYMENT_METHODS as readonly unknown[]).includes(value);

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};
