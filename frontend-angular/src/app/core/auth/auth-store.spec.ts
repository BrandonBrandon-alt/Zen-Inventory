import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, SESSION_STORAGE_KEY } from './auth-store';
import type { AuthSession } from './auth-session';

const session: AuthSession = {
  token: 'jwt-123',
  email: 'ana@zen.com',
  nombre: 'Ana',
  rol: 'ADMIN',
  id: 7,
  sucursalId: 3,
};

function createStore(): AuthStore {
  TestBed.resetTestingModule();
  return TestBed.inject(AuthStore);
}

describe('AuthStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('arranca sin sesión cuando no hay nada guardado', () => {
    const store = createStore();
    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
  });

  it('start() expone la sesión y la persiste en una sola clave', () => {
    const store = createStore();
    store.start(session);
    expect(store.session()).toEqual(session);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.token()).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(session);
  });

  it('restaura una sesión válida guardada', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(createStore().session()).toEqual(session);
  });

  it('clear() borra la sesión del estado y del almacenamiento', () => {
    const store = createStore();
    store.start(session);
    store.clear();
    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignora JSON corrupto sin lanzar', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{no-es-json');
    expect(createStore().session()).toBeNull();
  });

  it.each([
    ['sin token', { ...session, token: undefined }],
    ['token vacío', { ...session, token: '' }],
    ['id no numérico', { ...session, id: '7' }],
    ['rol de tipo incorrecto', { ...session, rol: 5 }],
    ['sucursalId de tipo incorrecto', { ...session, sucursalId: 'x' }],
  ])('descarta una sesión guardada con forma inválida (%s)', (_name, bad) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(bad));
    expect(createStore().session()).toBeNull();
  });

  it('arranca sin sesión si localStorage lanza (modo privado/bloqueado)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createStore().session()).toBeNull();
  });

  it('start() mantiene la sesión en memoria aunque no pueda persistir', () => {
    const store = createStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => store.start(session)).not.toThrow();
    expect(store.isAuthenticated()).toBe(true);
  });
});
