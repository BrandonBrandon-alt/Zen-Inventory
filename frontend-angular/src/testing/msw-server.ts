import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { components } from '@core/api/schema';

/** Origen ficticio de la API en los tests; se inyecta como API_BASE_URL. */
export const TEST_API = 'http://api.test';

type LoginResponse = components['schemas']['LoginResponse'];

/** Respuesta de login válida, tipada con el contrato del backend: si el OpenAPI cambia, esto deja de compilar. */
export const okLogin: LoginResponse = {
  token: 'jwt-123',
  tipo: 'Bearer',
  email: 'ana@zen.com',
  nombre: 'Ana',
  rol: 'ADMIN',
  id: 7,
  sucursalId: 3,
};

export const server = setupServer(
  http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.json(okLogin)),
);

/** Cuerpo de error con el contrato del backend (`ErrorResponse`): status, code, message, path, traceId, timestamp. */
export function apiErrorBody(
  status: number,
  code: string,
  message: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return { status, code, message, path: '/api/x', traceId: 'a1b2c3d4', timestamp: '2026-01-01T00:00:00', ...extras };
}
