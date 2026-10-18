import { describe, expect, it } from 'vitest';
import { purchaseActions } from './purchase-permissions';
import type { PaymentStatus, Purchase, ReceptionStatus } from './purchases-api';

const purchase = (reception: ReceptionStatus, payment: PaymentStatus = 'POR_PAGAR'): Purchase => ({
  id: 1,
  reception,
  payment,
  supplierId: 1,
  branchId: 1,
  requestDate: null,
  estimatedArrival: null,
  actualArrival: null,
  paymentDueDays: 30,
  paymentDueDate: null,
  total: 100,
  reason: '',
  lines: [],
});

const allowed = (p: Purchase, role: Parameters<typeof purchaseActions>[1]) =>
  Object.entries(purchaseActions(p, role))
    .filter(([, on]) => on)
    .map(([name]) => name);

describe('purchaseActions', () => {
  it('una orden por aprobar la aprueban o cancelan ADMIN y MANAGER; el operador no hace nada', () => {
    expect(allowed(purchase('AWAITING_APPROVAL'), 'MANAGER')).toEqual(['approve', 'cancel']);
    expect(allowed(purchase('AWAITING_APPROVAL'), 'ADMIN')).toEqual(['approve', 'cancel']);
    expect(allowed(purchase('AWAITING_APPROVAL'), 'OPERADOR_INVENTARIO')).toEqual([]);
  });

  it('una orden aprobada se marca como enviada, se recibe o se cancela', () => {
    expect(allowed(purchase('PENDING'), 'MANAGER')).toEqual(['dispatch', 'receive', 'cancel']);
    expect(allowed(purchase('PENDING'), 'OPERADOR_INVENTARIO')).toEqual(['receive']);
  });

  it('una orden en camino se recibe o se cancela, pero ya no se marca como enviada', () => {
    expect(allowed(purchase('IN_TRANSIT'), 'MANAGER')).toEqual(['receive', 'cancel']);
  });

  it('una recibida parcialmente se sigue recibiendo, se paga, y solo el ADMIN la cierra con faltante', () => {
    expect(allowed(purchase('RECEIVED_PARTIAL'), 'MANAGER')).toEqual(['receive', 'pay']);
    expect(allowed(purchase('RECEIVED_PARTIAL'), 'ADMIN')).toEqual(['receive', 'pay', 'closeShortfall']);
    expect(allowed(purchase('RECEIVED_PARTIAL'), 'OPERADOR_INVENTARIO')).toEqual(['receive']);
  });

  it('una recibida completa solo se paga (gerencia) y ya no se puede cancelar ni recibir', () => {
    expect(allowed(purchase('RECEIVED_TOTAL'), 'MANAGER')).toEqual(['pay']);
    expect(allowed(purchase('RECEIVED_TOTAL'), 'OPERADOR_INVENTARIO')).toEqual([]);
  });

  it('una orden ya pagada no ofrece pagar otra vez', () => {
    expect(allowed(purchase('RECEIVED_TOTAL', 'PAGADO'), 'ADMIN')).toEqual([]);
  });

  it('una orden cancelada no ofrece nada', () => {
    expect(allowed(purchase('CANCELLED'), 'ADMIN')).toEqual([]);
  });

  it('el vendedor y quien no tiene rol no pueden nada', () => {
    for (const status of ['AWAITING_APPROVAL', 'PENDING', 'IN_TRANSIT', 'RECEIVED_PARTIAL', 'RECEIVED_TOTAL'] as const) {
      expect(allowed(purchase(status), 'SELLER')).toEqual([]);
      expect(allowed(purchase(status), null)).toEqual([]);
    }
  });
});
