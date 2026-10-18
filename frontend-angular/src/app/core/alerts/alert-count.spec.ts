import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { server, TEST_API } from '@testing/msw-server';
import { ALERT_COUNT_INTERVAL, AlertCount } from './alert-count';

const URL_ALERTS = `${TEST_API}/api/v1/alerts`;
const session = (rol: string) => ({ token: 't', email: 'e', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

function setup(rol: string | null) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
  const auth = TestBed.inject(AuthStore);
  if (rol) auth.start(session(rol));
  return { auth, counter: TestBed.inject(AlertCount) };
}

const flush = async () => {
  TestBed.tick();
  await new Promise((resolve) => setTimeout(resolve, 30));
};

describe('AlertCount', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('cuenta las alertas activas de quien tiene acceso', async () => {
    server.use(http.get(URL_ALERTS, () => HttpResponse.json([{ id: 1 }, { id: 2 }, { id: 3 }])));
    const { counter } = setup('MANAGER');
    await flush();
    expect(counter.count()).toBe(3);
  });

  it('el vendedor no tiene acceso a las alertas: ni pregunta ni cuenta', async () => {
    let calls = 0;
    server.use(http.get(URL_ALERTS, () => ((calls += 1), HttpResponse.json([{ id: 1 }]))));
    const { counter } = setup('SELLER');
    await flush();
    counter.refresh();
    await flush();
    expect(calls).toBe(0);
    expect(counter.count()).toBe(0);
  });

  it('sin sesión no pregunta', async () => {
    let calls = 0;
    server.use(http.get(URL_ALERTS, () => ((calls += 1), HttpResponse.json([]))));
    setup(null);
    await flush();
    expect(calls).toBe(0);
  });

  it('refresh() vuelve a contar (tras resolver una alerta)', async () => {
    let alerts = [{ id: 1 }, { id: 2 }];
    server.use(http.get(URL_ALERTS, () => HttpResponse.json(alerts)));
    const { counter } = setup('ADMIN');
    await flush();
    expect(counter.count()).toBe(2);
    alerts = [{ id: 2 }];
    counter.refresh();
    await flush();
    expect(counter.count()).toBe(1);
  });

  it('si la consulta falla conserva el último número y no avisa', async () => {
    let fail = false;
    server.use(http.get(URL_ALERTS, () => (fail ? HttpResponse.error() : HttpResponse.json([{ id: 1 }]))));
    const { counter } = setup('ADMIN');
    await flush();
    fail = true;
    counter.refresh();
    await flush();
    expect(counter.count()).toBe(1);
  });

  it('al cerrar sesión vuelve a 0', async () => {
    server.use(http.get(URL_ALERTS, () => HttpResponse.json([{ id: 1 }, { id: 2 }])));
    const { auth, counter } = setup('ADMIN');
    await flush();
    expect(counter.count()).toBe(2);
    auth.clear();
    await flush();
    expect(counter.count()).toBe(0);
  });

  it('se actualiza solo cada minuto', async () => {
    let calls = 0;
    server.use(http.get(URL_ALERTS, () => ((calls += 1), HttpResponse.json([{ id: 1 }]))));
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup('ADMIN');
    await flush();
    const first = calls;
    vi.advanceTimersByTime(ALERT_COUNT_INTERVAL);
    await flush();
    expect(calls).toBe(first + 1);
  });
});
