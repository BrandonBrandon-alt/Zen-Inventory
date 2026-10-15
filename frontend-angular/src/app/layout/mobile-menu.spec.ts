import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MobileMenu } from './mobile-menu';

describe('MobileMenu', () => {
  it('empieza cerrado, se abre y se cierra con toggle()', () => {
    const menu = TestBed.inject(MobileMenu);
    expect(menu.open()).toBe(false);
    menu.toggle();
    expect(menu.open()).toBe(true);
    menu.toggle();
    expect(menu.open()).toBe(false);
  });

  it('close() cierra siempre, esté como esté', () => {
    const menu = TestBed.inject(MobileMenu);
    menu.close();
    expect(menu.open()).toBe(false);
    menu.toggle();
    menu.close();
    expect(menu.open()).toBe(false);
  });
});
