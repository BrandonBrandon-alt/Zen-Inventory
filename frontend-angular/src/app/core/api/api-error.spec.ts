import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api-error';

const http = (status: number, body: unknown) =>
  new HttpErrorResponse({ status, statusText: 'x', url: '/api/x', error: body });

describe('toApiError', () => {
  it('interpreta el contrato del backend (código, mensaje, traceId)', () => {
    const error = toApiError(
      http(422, {
        status: 422,
        code: 'INSUFFICIENT_STOCK',
        message: 'Stock insuficiente de Tornillo',
        path: '/api/sales',
        traceId: 'a1b2c3d4',
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.message).toBe('Stock insuficiente de Tornillo');
    expect(error.traceId).toBe('a1b2c3d4');
    expect(error.fieldErrors).toEqual({});
  });

  it('convierte fieldErrors en un mapa campo → mensaje (el primero de cada campo)', () => {
    const error = toApiError(
      http(400, {
        code: 'VALIDATION_FAILED',
        message: 'nombre: obligatorio',
        fieldErrors: [
          { field: 'nombre', message: 'El nombre es obligatorio' },
          { field: 'nombre', message: 'Entre 3 y 100 caracteres' },
          { field: 'direccion', message: 'La dirección es obligatoria' },
        ],
      }),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors).toEqual({
      nombre: 'El nombre es obligatorio',
      direccion: 'La dirección es obligatoria',
    });
  });

  it('ignora fieldErrors mal formados sin fallar', () => {
    const error = toApiError(http(400, { code: 'VALIDATION_FAILED', message: 'x', fieldErrors: [null, 3, { field: 5 }, { field: 'a', message: 'ok' }] }));
    expect(error.fieldErrors).toEqual({ a: 'ok' });
  });

  it('un código desconocido para el frontend se trata como UNKNOWN pero conserva el mensaje', () => {
    const error = toApiError(http(409, { code: 'CODIGO_FUTURO', message: 'Algo pasó' }));
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('Algo pasó');
    expect(error.status).toBe(409);
  });

  it('formato anterior (solo message): deriva el código del status', () => {
    const error = toApiError(http(404, { message: 'Sucursal no encontrada con ID: 7', timestamp: 't' }));
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).toBe('Sucursal no encontrada con ID: 7');
  });

  it('error de red (status 0): NETWORK_ERROR con mensaje propio', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toContain('No se pudo conectar');
  });

  it.each([502, 503, 504])('un %s del proxy (cuerpo HTML) es SERVER_UNAVAILABLE', (status) => {
    const error = toApiError(http(status, '<html><body>Bad Gateway</body></html>'));
    expect(error.code).toBe('SERVER_UNAVAILABLE');
    expect(error.message).not.toContain('<html>');
  });

  it('un 503 que SÍ trae el contrato del backend conserva su código y mensaje (solo se reemplaza el HTML del proxy)', () => {
    const error = toApiError(http(503, { code: 'INTERNAL_ERROR', message: 'Mantenimiento programado' }));
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Mantenimiento programado');
  });

  it('un 500 sin cuerpo útil es INTERNAL_ERROR genérico', () => {
    const error = toApiError(http(500, null));
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).not.toBe('');
  });

  it('un 500 con contrato usa el mensaje del backend (ya es genérico y trae el traceId)', () => {
    const error = toApiError(
      http(500, { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado… código: a1b2c3d4', traceId: 'a1b2c3d4' }),
    );
    expect(error.message).toContain('a1b2c3d4');
  });

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'ACCESS_DENIED'],
  ])('un %s con cuerpo vacío (backend antiguo) se interpreta como %s', (status, code) => {
    const error = toApiError(http(status, null));
    expect(error.code).toBe(code);
    expect(error.message).not.toBe('');
  });

  it('un cuerpo con message vacío o de tipo incorrecto usa el mensaje por defecto', () => {
    expect(toApiError(http(400, { message: '' })).message).not.toBe('');
    expect(toApiError(http(400, { message: 42 })).message).not.toBe('');
  });

  it('es idempotente: un ApiError se devuelve tal cual', () => {
    const original = new ApiError(409, 'DUPLICATE_SKU', 'Ya existe');
    expect(toApiError(original)).toBe(original);
  });

  it('un error que no es HTTP se convierte en UNKNOWN sin perder el control del flujo', () => {
    const error = toApiError(new TypeError('boom interno'));
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).not.toContain('boom interno');
  });
});

describe('ApiError', () => {
  it('isSessionProblem identifica los errores que exigen volver a iniciar sesión', () => {
    expect(new ApiError(401, 'TOKEN_EXPIRED', 'x').isSessionProblem).toBe(true);
    expect(new ApiError(401, 'INVALID_TOKEN', 'x').isSessionProblem).toBe(true);
    expect(new ApiError(401, 'UNAUTHENTICATED', 'x').isSessionProblem).toBe(true);
    // Con sesión abierta, una cuenta desactivada también obliga a salir (en el login lo trata AuthApi).
    expect(new ApiError(401, 'ACCOUNT_DISABLED', 'x').isSessionProblem).toBe(true);
    expect(new ApiError(401, 'INVALID_CREDENTIALS', 'x').isSessionProblem).toBe(false);
    expect(new ApiError(403, 'ACCESS_DENIED', 'x').isSessionProblem).toBe(false);
  });

  it('isGlobal marca los errores que no pertenecen a ningún formulario', () => {
    for (const code of ['NETWORK_ERROR', 'SERVER_UNAVAILABLE', 'INTERNAL_ERROR', 'ACCESS_DENIED', 'TOKEN_EXPIRED'] as const) {
      expect(new ApiError(500, code, 'x').isGlobal).toBe(true);
    }
    for (const code of ['VALIDATION_FAILED', 'RESOURCE_NOT_FOUND', 'DUPLICATE_SKU', 'INVALID_CREDENTIALS', 'INSUFFICIENT_STOCK'] as const) {
      expect(new ApiError(400, code, 'x').isGlobal).toBe(false);
    }
  });
});
