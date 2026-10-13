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
