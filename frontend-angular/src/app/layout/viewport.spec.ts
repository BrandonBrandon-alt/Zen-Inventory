import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_QUERY, Viewport } from './viewport';

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches,
    addEventListener: vi.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: Listener) => listeners.delete(l)),
  };
  const matchMedia = vi.fn().mockReturnValue(query);
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
  return { matchMedia, query, emit: (value: boolean) => listeners.forEach((l) => l({ matches: value } as MediaQueryListEvent)) };
}

describe('Viewport', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    TestBed.resetTestingModule();
  });

  it('sin matchMedia asume escritorio', () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    expect(TestBed.inject(Viewport).isDesktop()).toBe(true);
  });

  it('consulta el ancho de escritorio de 768 px', () => {
    const { matchMedia } = mockMatchMedia(true);
    TestBed.inject(Viewport);
    expect(matchMedia).toHaveBeenCalledWith(DESKTOP_QUERY);
    expect(DESKTOP_QUERY).toBe('(min-width: 768px)');
  });

  it.each([[true], [false]])('refleja el estado inicial (escritorio=%s)', (desktop) => {
    mockMatchMedia(desktop);
    expect(TestBed.inject(Viewport).isDesktop()).toBe(desktop);
  });

  it('reacciona cuando cambia el tamaño de la ventana', () => {
    const { emit } = mockMatchMedia(true);
    const viewport = TestBed.inject(Viewport);
    emit(false);
    expect(viewport.isDesktop()).toBe(false);
    emit(true);
    expect(viewport.isDesktop()).toBe(true);
  });

  it('deja de escuchar cuando se destruye', () => {
    const { query } = mockMatchMedia(true);
    TestBed.inject(Viewport);
    TestBed.resetTestingModule();
    expect(query.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
