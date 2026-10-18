import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../api/api-base-url';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../session/auth-store';

const session = { token: 'jwt-123', email: 'a@z.com', nombre: 'A', rol: 'ADMIN', id: 1 };

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let store: AuthStore;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigateByUrl = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  it('añade Authorization: Bearer cuando hay sesión', () => {
    store.start(session);
    http.get('/api/branches').subscribe();
    const req = controller.expectOne('/api/branches');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush([]);
  });

  it('no añade Authorization sin sesión', () => {
    http.get('/api/branches').subscribe();
    const req = controller.expectOne('/api/branches');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('no envía el token al endpoint de login', () => {
    store.start(session);
    http.post('/api/auth/login', {}).subscribe();
    const req = controller.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('ante 401 con sesión: limpia la sesión, redirige a /login y propaga el error', () => {
    store.start(session);
    let status = 0;
    http.get('/api/branches').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/branches').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(store.isAuthenticated()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('401 del propio login (credenciales malas): no limpia ni redirige, propaga el error', () => {
    store.start(session);
    let status = 0;
    http.post('/api/auth/login', {}).subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(store.isAuthenticated()).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('401 sin sesión activa: propaga el error sin redirigir', () => {
    let status = 0;
    http.get('/api/branches').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/branches').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('error de red (status 0): propaga el error sin tocar la sesión', () => {
    store.start(session);
    let status = -1;
    http.get('/api/branches').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/branches').error(new ProgressEvent('error'));
    expect(status).toBe(0);
    expect(store.isAuthenticated()).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});

describe('authInterceptor — alcance del token', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let store: AuthStore;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  function configure(baseUrl: string) {
    localStorage.clear();
    navigateByUrl = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    store.start(session);
  }

  it('mismo origen (API_BASE_URL vacía): no envía el token a una URL absoluta de terceros', () => {
    configure('');
    http.get('https://terceros.example/x').subscribe();
    const req = controller.expectOne('https://terceros.example/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('mismo origen: una URL sin protocolo (//host) es de otro origen y no lleva el token', () => {
    configure('');
    http.get('//terceros.example/x').subscribe();
    const req = controller.expectOne('//terceros.example/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('API_BASE_URL absoluta: envía el token a esa API y no a otros orígenes', () => {
    configure('http://api.test');
    http.get('http://api.test/api/branches').subscribe();
    const own = controller.expectOne('http://api.test/api/branches');
    expect(own.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    own.flush([]);

    http.get('https://terceros.example/x').subscribe();
    const other = controller.expectOne('https://terceros.example/x');
    expect(other.request.headers.has('Authorization')).toBe(false);
    other.flush({});
  });

  it('un 401 de un origen ajeno no cierra la sesión ni redirige', () => {
    configure('http://api.test');
    http.get('https://terceros.example/x').subscribe({ error: () => undefined });
    controller
      .expectOne('https://terceros.example/x')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(store.isAuthenticated()).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
