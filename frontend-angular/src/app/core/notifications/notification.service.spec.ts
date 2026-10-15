import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    service = TestBed.inject(NotificationService);
  });
  afterEach(() => vi.useRealTimers());

  it('empieza sin avisos', () => {
    expect(service.items()).toEqual([]);
  });

  it('show() agrega un aviso con tipo y mensaje', () => {
    service.error('Algo falló');
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]).toMatchObject({ kind: 'error', message: 'Algo falló' });
  });

  it('los atajos usan el tipo correspondiente', () => {
    service.warning('a');
    service.success('b');
    service.info('c');
    expect(service.items().map((n) => n.kind)).toEqual(['warning', 'success', 'info']);
  });

  it('dismiss() quita solo el aviso indicado', () => {
    service.error('uno');
    service.error('dos');
    const [first] = service.items();
    service.dismiss(first.id);
    expect(service.items().map((n) => n.message)).toEqual(['dos']);
  });

  it('un aviso desaparece solo pasado su tiempo (los errores duran más que los de éxito)', () => {
    service.success('ok');
    service.error('mal');
    vi.advanceTimersByTime(4_000);
    expect(service.items().map((n) => n.message)).toEqual(['mal']);
    vi.advanceTimersByTime(4_000);
    expect(service.items()).toEqual([]);
  });

  it('un aviso idéntico ya visible no se duplica (varias peticiones fallando a la vez)', () => {
    service.error('Sin conexión');
    service.error('Sin conexión');
    service.error('Sin conexión');
    expect(service.items()).toHaveLength(1);
  });

  it('el mismo mensaje con otro tipo sí se muestra', () => {
    service.error('Mensaje');
    service.warning('Mensaje');
    expect(service.items()).toHaveLength(2);
  });

  it('tras descartarlo, el mismo aviso puede volver a mostrarse', () => {
    service.error('Sin conexión');
    service.dismiss(service.items()[0].id);
    service.error('Sin conexión');
    expect(service.items()).toHaveLength(1);
  });

  it('mantiene como máximo 4 avisos visibles: se descarta el más antiguo', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => service.error(m));
    expect(service.items().map((n) => n.message)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('descartar a mano cancela su temporizador (no quedan temporizadores huérfanos)', () => {
    service.error('uno');
    expect(vi.getTimerCount()).toBe(1);
    service.dismiss(service.items()[0].id);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('el aviso descartado por el límite también libera su temporizador', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => service.error(m));
    expect(vi.getTimerCount()).toBe(4);
  });
});
