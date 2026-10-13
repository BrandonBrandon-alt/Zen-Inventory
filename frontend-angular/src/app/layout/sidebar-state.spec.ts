import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_STORAGE_KEY, SidebarState } from './sidebar-state';

function createState(): SidebarState {
  TestBed.resetTestingModule();
  return TestBed.inject(SidebarState);
}

describe('SidebarState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

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
});
