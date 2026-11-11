import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debouncedText } from './debounced-text';

describe('debouncedText', () => {
  afterEach(() => vi.useRealTimers());

  it('el texto sigue cada tecla; el término llega recortado recién tras la espera', () => {
    vi.useFakeTimers();
    const search = TestBed.runInInjectionContext(() => debouncedText(300));
    search.set('a');
    search.set('ab ');
    expect(search.text()).toBe('ab ');
    vi.advanceTimersByTime(299);
    expect(search.term()).toBe('');
    vi.advanceTimersByTime(1);
    expect(search.term()).toBe('ab');
  });

  it('clear vacía el texto y el término sin esperar, y cancela lo pendiente', () => {
    vi.useFakeTimers();
    const search = TestBed.runInInjectionContext(() => debouncedText(300));
    search.set('tornillo');
    search.clear();
    expect(search.text()).toBe('');
    expect(search.term()).toBe('');
    vi.advanceTimersByTime(300);
    expect(search.term()).toBe('');
  });
});
