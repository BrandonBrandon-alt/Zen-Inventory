import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url';

describe('API_BASE_URL', () => {
  it('por defecto es vacío (mismo origen: proxy en dev, servidor web en prod)', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('');
  });

  it('se puede sobrescribir por DI', () => {
    TestBed.configureTestingModule({ providers: [{ provide: API_BASE_URL, useValue: 'http://api.test' }] });
    expect(TestBed.inject(API_BASE_URL)).toBe('http://api.test');
  });
});
