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
});
