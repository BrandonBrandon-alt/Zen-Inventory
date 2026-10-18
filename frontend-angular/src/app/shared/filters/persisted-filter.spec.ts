import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '@core/auth/session/auth-store';
import { codecs, persistedFilter } from './persisted-filter';

const KEY = (user: number, screen = 'pantalla') => `zen:filters:${user}:${screen}`;
const stored = (user: number, screen = 'pantalla') => JSON.parse(localStorage.getItem(KEY(user, screen)) ?? 'null');
const flush = () => TestBed.tick();

@Component({ selector: 'app-host', template: '' })
class Host {
  readonly status = persistedFilter('pantalla', 'status', 'all' as 'all' | 'open', codecs.oneOf(['all', 'open'] as const));
  readonly min = persistedFilter('pantalla', 'min', null as number | null, codecs.nullable(codecs.number()));
  readonly from = persistedFilter('pantalla', 'from', null as Date | null, codecs.nullable(codecs.date()));
  readonly open = persistedFilter('pantalla', 'open', false, codecs.bool());
  readonly name = persistedFilter('pantalla', 'name', '', codecs.text(10));
}

function setup(userId: number | null = 7) {
  TestBed.resetTestingModule();
  if (userId !== null) TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'Ana', rol: 'ADMIN', id: userId });
  return TestBed.createComponent(Host).componentInstance;
}

describe('persistedFilter', () => {
  beforeEach(() => localStorage.clear());

  it('arranca con el valor inicial y no guarda nada mientras no cambie', () => {
    setup();
    flush();
    expect(localStorage.getItem(KEY(7))).toBeNull();
  });

  it('guarda lo que cambia y lo recuerda la próxima vez (fechas incluidas)', () => {
    const first = setup();
    first.status.set('open');
    first.min.set(250);
    first.from.set(new Date(2026, 9, 5, 12));
    first.open.set(true);
    flush();
    expect(stored(7)).toMatchObject({ status: 'open', min: 250, open: true });

    const second = setup();
    expect(second.status()).toBe('open');
    expect(second.min()).toBe(250);
    expect(second.from()?.getTime()).toBe(new Date(2026, 9, 5, 12).getTime());
    expect(second.open()).toBe(true);
  });

  it('volver al valor inicial borra lo guardado', () => {
    const host = setup();
    host.status.set('open');
    flush();
    expect(stored(7)).not.toBeNull();
    host.status.set('all');
    flush();
    expect(localStorage.getItem(KEY(7))).toBeNull();
  });

  it('cada persona tiene sus filtros', () => {
    const ana = setup(7);
    ana.status.set('open');
    flush();
    expect(setup(8).status()).toBe('all');
    expect(setup(7).status()).toBe('open');
  });

  it('descarta valores guardados que ya no sirven: opción inexistente, tipo equivocado, texto muy largo, fecha rota', () => {
    localStorage.setItem(KEY(7), JSON.stringify({ status: 'borrada', min: 'abc', name: 'x'.repeat(50), from: 'no es fecha', open: 'sí' }));
    const host = setup();
    expect(host.status()).toBe('all');
    expect(host.min()).toBeNull();
    expect(host.name()).toBe('');
    expect(host.from()).toBeNull();
    expect(host.open()).toBe(false);
  });

  it('un contenido ilegible en el almacenamiento no rompe la pantalla', () => {
    localStorage.setItem(KEY(7), '{no es json');
    expect(setup().status()).toBe('all');
    localStorage.setItem(KEY(7), '[1,2]');
    expect(setup().status()).toBe('all');
  });

  it('sin sesión funciona pero no recuerda nada', () => {
    const host = setup(null);
    host.status.set('open');
    flush();
    expect(host.status()).toBe('open');
    expect(Object.keys(localStorage).filter((k) => k.startsWith('zen:filters'))).toEqual([]);
  });

  it('si el almacenamiento falla (cuota llena o bloqueado) el filtro sigue funcionando', () => {
    const host = setup();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('lleno', 'QuotaExceededError');
    };
    try {
      host.status.set('open');
      expect(() => flush()).not.toThrow();
      expect(host.status()).toBe('open');
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

