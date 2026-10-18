import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIDEBAR_AUTOHIDE_STORAGE_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  SidebarState,
} from './sidebar-state';

function createState(): SidebarState {
  TestBed.resetTestingModule();
  return TestBed.inject(SidebarState);
}

describe('SidebarState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('ocultar automáticamente parte desactivado, alterna y se recuerda', () => {
    expect(createState().autoHide()).toBe(false);
    const state = createState();
    state.toggleAutoHide();
    expect(state.autoHide()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_AUTOHIDE_STORAGE_KEY)).toBe('true');
    expect(createState().autoHide()).toBe(true);
    state.toggleAutoHide();
    expect(state.autoHide()).toBe(false);
  });

  it('ocultar automáticamente funciona en memoria aunque no pueda leer ni guardar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const state = createState();
    expect(state.autoHide()).toBe(false);
    state.toggleAutoHide();
    expect(state.autoHide()).toBe(true);
  });

  it('por defecto está expandido', () => {
    expect(createState().collapsed()).toBe(false);
  });

  it('restaura el estado colapsado guardado', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
    expect(createState().collapsed()).toBe(true);
  });

  it('toggle() alterna y persiste', () => {
    const state = createState();
    state.toggle();
    expect(state.collapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    state.toggle();
    expect(state.collapsed()).toBe(false);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
  });

  it('arranca expandido si localStorage lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createState().collapsed()).toBe(false);
  });

  it('toggle() funciona en memoria aunque no pueda persistir', () => {
    const state = createState();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => state.toggle()).not.toThrow();
    expect(state.collapsed()).toBe(true);
  });

  describe('ancho', () => {
    it('por defecto usa el ancho estándar', () => {
      expect(createState().width()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });

    it('setWidth() cambia el ancho y lo persiste', () => {
      const state = createState();
      state.setWidth(300);
      expect(state.width()).toBe(300);
      expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('300');
    });

    it('setWidth() respeta los límites mínimo y máximo', () => {
      const state = createState();
      state.setWidth(SIDEBAR_MAX_WIDTH + 500);
      expect(state.width()).toBe(SIDEBAR_MAX_WIDTH);
      state.setWidth(10);
      expect(state.width()).toBe(SIDEBAR_MIN_WIDTH);
    });

    it('setWidth() redondea a píxeles enteros', () => {
      const state = createState();
      state.setWidth(250.6);
      expect(state.width()).toBe(251);
    });

    it('ignora valores no numéricos', () => {
      const state = createState();
      state.setWidth(300);
      state.setWidth(Number.NaN);
      expect(state.width()).toBe(300);
    });

    it('restaura el ancho guardado', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '320');
      expect(createState().width()).toBe(320);
    });

    it.each([['abc'], [''], ['-5'], ['9999'], ['NaN']])(
      'un ancho guardado inválido (%j) se corrige a un valor dentro de los límites',
      (stored) => {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, stored);
        const width = createState().width();
        expect(width).toBeGreaterThanOrEqual(SIDEBAR_MIN_WIDTH);
        expect(width).toBeLessThanOrEqual(SIDEBAR_MAX_WIDTH);
      },
    );

    it('resetWidth() vuelve al ancho estándar y lo persiste', () => {
      const state = createState();
      state.setWidth(340);
      state.resetWidth();
      expect(state.width()).toBe(SIDEBAR_DEFAULT_WIDTH);
      expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(SIDEBAR_DEFAULT_WIDTH));
    });

    it('colapsar no pierde el ancho elegido', () => {
      const state = createState();
      state.setWidth(310);
      state.toggle();
      state.toggle();
      expect(state.width()).toBe(310);
    });

    it('setWidth() funciona en memoria aunque no pueda persistir', () => {
      const state = createState();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      expect(() => state.setWidth(280)).not.toThrow();
      expect(state.width()).toBe(280);
    });

    it('arranca con el ancho por defecto si localStorage lanza al leer', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      expect(createState().width()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });
  });
});
