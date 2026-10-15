import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

function createService(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });
  afterEach(() => vi.restoreAllMocks());

  it('por defecto usa el tema oscuro y lo aplica al documento', () => {
    const service = createService();
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('restaura el tema guardado', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const service = createService();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('ignora un valor guardado inválido', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'azul');
    expect(createService().theme()).toBe('dark');
  });

  it('toggle() alterna, persiste y actualiza el documento', () => {
    const service = createService();
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('arranca en oscuro si localStorage lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createService().theme()).toBe('dark');
  });

  it('toggle() funciona en memoria aunque no pueda persistir', () => {
    const service = createService();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => service.toggle()).not.toThrow();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  describe('transición animada (View Transitions)', () => {
    const origin = { x: 310, y: 42 };
    const doc = document as unknown as { startViewTransition?: unknown };
    let start: ReturnType<typeof vi.fn>;

    /** Imita al navegador: el callback con el cambio se ejecuta de forma asíncrona, tras capturar la pantalla anterior. */
    function supportViewTransitions(): void {
      start = vi.fn((update: () => void) => {
        const finished = Promise.resolve().then(update).then(() => Promise.resolve());
        return { finished, ready: Promise.resolve(), skipTransition: vi.fn() };
      });
      doc.startViewTransition = start;
    }

    function prefersReducedMotion(reduce: boolean): void {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({ matches: reduce && query.includes('reduce') })),
      });
    }

    beforeEach(() => {
      supportViewTransitions();
      prefersReducedMotion(false);
    });
    afterEach(() => {
      delete doc.startViewTransition;
      delete (window as { matchMedia?: unknown }).matchMedia;
      document.documentElement.removeAttribute('data-theme-switching');
      document.documentElement.style.removeProperty('--theme-x');
      document.documentElement.style.removeProperty('--theme-y');
    });

    it('con origen y navegador compatible anima: el cambio llega dentro de la transición, no antes', async () => {
      const service = createService();
      service.toggle(origin);
      expect(start).toHaveBeenCalledTimes(1);
      // La pantalla anterior se captura antes de aplicar el tema nuevo.
      expect(document.documentElement.dataset['theme']).toBe('dark');
      await vi.waitFor(() => expect(document.documentElement.dataset['theme']).toBe('light'));
      expect(service.theme()).toBe('light');
    });

    it('expone el punto de origen (centro del botón) y la marca de "cambiando" mientras dura, y los limpia al terminar', async () => {
      const service = createService();
      service.toggle(origin);
      expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('310px');
      expect(document.documentElement.style.getPropertyValue('--theme-y')).toBe('42px');
      expect(document.documentElement).toHaveAttribute('data-theme-switching');
      await vi.waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-theme-switching'));
      expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('');
      expect(document.documentElement.style.getPropertyValue('--theme-y')).toBe('');
    });

    it('guarda la preferencia al instante, sin esperar a la animación', () => {
      createService().toggle(origin);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('sin origen (cambio por código) no anima', () => {
      const service = createService();
      service.toggle();
      expect(start).not.toHaveBeenCalled();
      expect(service.theme()).toBe('light');
      expect(document.documentElement.dataset['theme']).toBe('light');
    });

    it('si el navegador no soporta View Transitions cambia al instante', () => {
      delete doc.startViewTransition;
      const service = createService();
      service.toggle(origin);
      expect(service.theme()).toBe('light');
      expect(document.documentElement.dataset['theme']).toBe('light');
    });

    it('quien pidió menos movimiento recibe el cambio al instante, sin transición', () => {
      prefersReducedMotion(true);
      const service = createService();
      service.toggle(origin);
      expect(start).not.toHaveBeenCalled();
      expect(service.theme()).toBe('light');
    });

    it('dos cambios seguidos terminan en el estado correcto (cada uno parte del último pedido, no del aplicado)', async () => {
      const service = createService();
      service.toggle(origin);
      service.toggle(origin);
      await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(service.theme()).toBe('dark'));
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('si startViewTransition falla, aplica el cambio igualmente', () => {
      doc.startViewTransition = vi.fn(() => {
        throw new Error('no disponible');
      });
      const service = createService();
      service.toggle(origin);
      expect(service.theme()).toBe('light');
      expect(document.documentElement).not.toHaveAttribute('data-theme-switching');
    });
  });
});
