import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@core/api/api-error';
import { Loadable } from './loadable';

describe('Loadable', () => {
  it('parte en reposo, pasa por carga y termina con los datos', () => {
    const state = new Loadable<number>();
    expect(state.status()).toBe('idle');
    const source = new Subject<number>();
    state.load(source);
    expect(state.status()).toBe('loading');
    expect(state.loading()).toBe(true);
    source.next(5);
    expect(state.status()).toBe('ready');
    expect(state.data()).toBe(5);
    expect(state.error()).toBeNull();
  });

  it('un error deja el mensaje del servidor y sin datos', () => {
    const state = new Loadable<number>();
    state.load(throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'Falla de prueba')));
    expect(state.status()).toBe('error');
    expect(state.error()).toBe('Falla de prueba');
    expect(state.data()).toBeNull();
  });

  it('descarta la respuesta de una carga anterior si ya se pidió otra', () => {
    const state = new Loadable<string>();
    const slow = new Subject<string>();
    state.load(slow);
    state.load(of('nueva'));
    slow.next('vieja');
    expect(state.data()).toBe('nueva');
  });

  it('un error tardío de una carga anterior tampoco pisa a la nueva', () => {
    const state = new Loadable<string>();
    const slow = new Subject<string>();
    state.load(slow);
    state.load(of('nueva'));
    slow.error(new ApiError(500, 'INTERNAL_ERROR', 'tarde'));
    expect(state.status()).toBe('ready');
    expect(state.error()).toBeNull();
  });

  it('en modo silencioso conserva los datos mientras llega la respuesta (sin volver a "cargando")', () => {
    const state = new Loadable<number>();
    state.load(of(1));
    const next = new Subject<number>();
    state.load(next, { silent: true });
    expect(state.status()).toBe('ready');
    expect(state.data()).toBe(1);
    next.next(2);
    expect(state.data()).toBe(2);
  });

  it('al recargar sin silencio conserva los datos viejos visibles hasta que llegan los nuevos', () => {
    const state = new Loadable<number>();
    state.load(of(1));
    state.load(new Subject<number>());
    expect(state.loading()).toBe(true);
    expect(state.data()).toBe(1);
  });
});
