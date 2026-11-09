import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT_MS, ExitDelay } from './exit-delay';

function mockMatchMedia(reduce: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: reduce }),
  });
}

describe('ExitDelay', () => {
  let exit: ExitDelay;
  beforeEach(() => {
    vi.useFakeTimers();
    exit = new ExitDelay(TestBed.inject(DestroyRef));
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  });

  it('con movimiento deja el panel visible EXIT_MS y recién entonces lo retira', () => {
    mockMatchMedia(false);
    const done = vi.fn();
    exit.begin(done);
    expect(exit.active()).toBe(true);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EXIT_MS - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(exit.active()).toBe(false);
  });

  it('quien pide menos movimiento no espera: se retira al instante', () => {
    mockMatchMedia(true);
    const done = vi.fn();
    exit.begin(done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(exit.active()).toBe(false);
  });

  it('sin matchMedia (no hay noción de movimiento) tampoco espera', () => {
    const done = vi.fn();
    exit.begin(done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('cancelar a mitad de la salida (se volvió a abrir) no retira nada', () => {
    mockMatchMedia(false);
    const done = vi.fn();
    exit.begin(done);
    vi.advanceTimersByTime(50);
    exit.cancel();
    vi.advanceTimersByTime(500);
    expect(done).not.toHaveBeenCalled();
    expect(exit.active()).toBe(false);
  });

  it('una segunda salida reemplaza a la primera: solo se retira una vez', () => {
    mockMatchMedia(false);
    const first = vi.fn();
    const second = vi.fn();
    exit.begin(first);
    vi.advanceTimersByTime(60);
    exit.begin(second);
    vi.advanceTimersByTime(EXIT_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
