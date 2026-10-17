import { provideHttpClient } from '@angular/common/http';
import { render, screen } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { server, TEST_API } from '@testing/msw-server';
import { UserAvatar } from './user-avatar';

const providers = [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }];
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('UserAvatar', () => {
  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => 'blob:foto');
    URL.revokeObjectURL = vi.fn();
  });

  it('sin versión (el usuario no tiene foto) muestra las iniciales y no pide nada', async () => {
    let called = false;
    server.use(http.get(`${TEST_API}/api/avatars/*`, () => ((called = true), new HttpResponse(null, { status: 404 }))));
    await render(UserAvatar, { inputs: { userId: 7, name: 'Ana Pérez' }, providers });
    await flush();
    expect(screen.getByText('AP')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('con versión pide la foto y la muestra cuando llega', async () => {
    server.use(http.get(`${TEST_API}/api/avatars/7`, () => new HttpResponse(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/jpeg' } })));
    const { container, fixture } = await render(UserAvatar, { inputs: { userId: 7, name: 'Ana Pérez', version: 'v1' }, providers });
    expect(screen.getByText('AP')).toBeInTheDocument(); // mientras llega
    await flush();
    fixture.detectChanges();
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:foto');
  });

  it('si la foto no se puede cargar, deja las iniciales', async () => {
    server.use(http.get(`${TEST_API}/api/avatars/7`, () => new HttpResponse(null, { status: 404 })));
    const { container, fixture } = await render(UserAvatar, { inputs: { userId: 7, name: 'Ana Pérez', version: 'v1' }, providers });
    await flush();
    fixture.detectChanges();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AP')).toBeInTheDocument();
  });
});
