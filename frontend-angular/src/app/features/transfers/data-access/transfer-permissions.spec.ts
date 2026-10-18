import { describe, expect, it } from 'vitest';
import { type Actor, transferActions } from './transfer-permissions';
import type { Transfer, TransferStatus } from './transfers-api';

const transfer = (status: TransferStatus): Transfer => ({
  id: 1,
  status,
  priority: 'NORMAL',
  originBranchId: 10,
  destinationBranchId: 20,
  requestDate: null,
  estimatedArrival: null,
  actualArrival: null,
  dispatchDate: null,
  carrier: '',
  trackingNumber: '',
  shippingCost: null,
  receiptNotes: '',
  resolutionReason: '',
  parentId: null,
  requester: '',
  authorizer: '',
  dispatcher: '',
  receiver: '',
  resolver: '',
  lines: [],
});

const admin: Actor = { role: 'ADMIN', branchId: null };
const origin = (role: Actor['role']): Actor => ({ role, branchId: 10 });
const destination = (role: Actor['role']): Actor => ({ role, branchId: 20 });
const outsider: Actor = { role: 'MANAGER', branchId: 99 };

/** Acciones permitidas, solo las verdaderas, para comparar de un vistazo. */
const allowed = (status: TransferStatus, actor: Actor) =>
  Object.entries(transferActions(transfer(status), actor))
    .filter(([, on]) => on)
    .map(([name]) => name);

describe('transferActions', () => {
  it('el gerente de destino aprueba un traslado pendiente; el de origen no', () => {
    expect(allowed('PENDING', destination('MANAGER'))).toContain('approve');
    expect(allowed('PENDING', origin('MANAGER'))).not.toContain('approve');
  });

  it('el operador de inventario nunca aprueba, autoriza, cancela, rechaza ni resuelve', () => {
    for (const status of ['PENDING', 'APPROVED_DEST', 'IN_TRANSIT', 'WITH_ISSUE'] as const) {
      expect(allowed(status, destination('OPERADOR_INVENTARIO'))).not.toEqual(expect.arrayContaining(['approve', 'cancel', 'reject', 'resolve']));
      expect(allowed(status, origin('OPERADOR_INVENTARIO'))).not.toEqual(expect.arrayContaining(['prepare', 'cancel', 'reject', 'resolve']));
    }
  });

  it('el gerente de origen autoriza la salida de un traslado aprobado', () => {
    expect(allowed('APPROVED_DEST', origin('MANAGER'))).toContain('prepare');
    expect(allowed('APPROVED_DEST', destination('MANAGER'))).not.toContain('prepare');
  });

  it('despachar lo hace el origen (incluido el operador) y recibir lo hace el destino (incluido el operador)', () => {
    expect(allowed('PREPARING', origin('OPERADOR_INVENTARIO'))).toEqual(['dispatch']);
    expect(allowed('PREPARING', destination('OPERADOR_INVENTARIO'))).toEqual([]);
    expect(allowed('IN_TRANSIT', destination('OPERADOR_INVENTARIO'))).toEqual(['receive']);
    expect(allowed('IN_TRANSIT', origin('OPERADOR_INVENTARIO'))).toEqual([]);
  });

  it('cancelar solo mientras el traslado no terminó; rechazar solo pendiente o en tránsito', () => {
    expect(allowed('PREPARING', origin('MANAGER'))).toContain('cancel');
    expect(allowed('PREPARING', origin('MANAGER'))).not.toContain('reject');
    expect(allowed('IN_TRANSIT', origin('MANAGER'))).toEqual(expect.arrayContaining(['cancel', 'reject']));
    for (const done of ['DELIVERED', 'CANCELLED', 'REJECTED', 'UNDER_CLAIM'] as const) {
      expect(allowed(done, admin)).toEqual([]);
    }
  });

  it('una novedad la resuelve gerencia de cualquiera de las dos sucursales', () => {
    expect(allowed('WITH_ISSUE', origin('MANAGER'))).toEqual(['resolve']);
    expect(allowed('WITH_ISSUE', destination('MANAGER'))).toEqual(['resolve']);
    expect(allowed('WITH_ISSUE', origin('OPERADOR_INVENTARIO'))).toEqual([]);
  });

  it('una sucursal que no participa no puede actuar', () => {
    for (const status of ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'WITH_ISSUE'] as const) {
      expect(allowed(status, outsider)).toEqual([]);
    }
  });

  it('sin rol o sin sucursal no se ofrece nada', () => {
    expect(allowed('PENDING', { role: null, branchId: 20 })).toEqual([]);
    expect(allowed('PENDING', { role: 'MANAGER', branchId: null })).toEqual([]);
  });

  it('el administrador actúa en cualquier paso, de ambos lados', () => {
    expect(allowed('PENDING', admin)).toEqual(expect.arrayContaining(['approve', 'cancel', 'reject']));
    expect(allowed('APPROVED_DEST', admin)).toContain('prepare');
    expect(allowed('PREPARING', admin)).toContain('dispatch');
    expect(allowed('IN_TRANSIT', admin)).toContain('receive');
    expect(allowed('WITH_ISSUE', admin)).toContain('resolve');
  });
});
