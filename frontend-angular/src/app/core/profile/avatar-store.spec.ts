import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { server, TEST_API } from '@testing/msw-server';
import { AvatarStore } from './avatar-store';

const URL_OF = (userId: number) => `${TEST_API}/api/avatars/${userId}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('AvatarStore', () => {
  let store: AvatarStore;
  let counter: number;
  const created: string[] = [];
  const revoked: string[] = [];

  beforeEach(() => {
    localStorage.clear();
    counter = 0;
    created.length = 0;
    revoked.length = 0;
    // jsdom no implementa URL.createObjectURL.
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:local/${++counter}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'Ana', rol: 'ADMIN', id: 1 });
    store = TestBed.inject(AvatarStore);
  });

  afterEach(() => localStorage.clear());

  it('descarga la foto con la versión en la URL y la expone como URL local', async () => {
    let requested = '';
    server.use(
      http.get(URL_OF(7), ({ request }) => {
        requested = request.url;
        return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
      }),
    );
    const url = store.urlFor(7, 'v1');
    expect(url()).toBeNull();
    await flush();
    expect(requested).toBe(`${URL_OF(7)}?v=v1`);
    expect(url()).toBe('blob:local/1');
  });

  it('no repite la descarga si ya tiene esa versión', async () => {
    let calls = 0;
    server.use(http.get(URL_OF(7), () => (calls++, new HttpResponse(new Uint8Array([1])))));
    const first = store.urlFor(7, 'v1');
    await flush();
    expect(store.urlFor(7, 'v1')).toBe(first);
    await flush();
    expect(calls).toBe(1);
  });

  it('una versión nueva descarga otra vez y libera la URL anterior', async () => {
    server.use(http.get(URL_OF(7), () => new HttpResponse(new Uint8Array([1]))));
    const first = store.urlFor(7, 'v1');
    await flush();
    const second = store.urlFor(7, 'v2');
    await flush();
    expect(revoked).toEqual(['blob:local/1']);
    expect(first()).toBe('blob:local/1');
    expect(second()).toBe('blob:local/2');
  });

  it('una respuesta tardía de una versión vieja se descarta', async () => {
    server.use(
      http.get(URL_OF(7), async ({ request }) => {
        const version = new URL(request.url).searchParams.get('v');
        if (version === 'v1') await new Promise((resolve) => setTimeout(resolve, 60));
        return new HttpResponse(new Uint8Array([1]));
      }),
    );
    const old = store.urlFor(7, 'v1');
    const current = store.urlFor(7, 'v2');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(old()).toBeNull();
    expect(current()).not.toBeNull();
    expect(created).toHaveLength(1);
  });

  it('si la foto no existe o falla, queda en null sin avisar a nadie', async () => {
    server.use(http.get(URL_OF(9), () => new HttpResponse(null, { status: 404 })));
    const url = store.urlFor(9, 'v1');
    await flush();
    expect(url()).toBeNull();
  });

  it('al cerrar sesión libera todas las URLs locales', async () => {
    server.use(http.get(URL_OF(7), () => new HttpResponse(new Uint8Array([1]))));
    store.urlFor(7, 'v1');
    await flush();
    TestBed.inject(AuthStore).clear();
    TestBed.tick();
    expect(revoked).toEqual(['blob:local/1']);
  });
});
