import { HttpErrorResponse } from '@angular/common/http';

/** Códigos de error del backend (`ErrorCode.java`). El frontend decide por código, nunca por el texto. */
const BACKEND_CODES = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'ACCESS_DENIED',
  'FORBIDDEN_ACTION',
  'VALIDATION_FAILED',
  'MALFORMED_REQUEST',
  'INVALID_PARAMETER',
  'MISSING_PARAMETER',
  'INVALID_ARGUMENT',
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
  'RESOURCE_NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'DUPLICATE_SKU',
  'DATA_INTEGRITY',
  'CONCURRENT_MODIFICATION',
  'INVALID_STATE',
  'ALREADY_RESOLVED',
  'INSUFFICIENT_STOCK',
  'EMPTY_SALE',
  'INVALID_RETURN_OPERATION',
  'INTERNAL_ERROR',
] as const;

/** Códigos que genera el propio frontend cuando no hay (o no se entiende) la respuesta del backend. */
type ClientCode = 'NETWORK_ERROR' | 'SERVER_UNAVAILABLE' | 'UNKNOWN';

export type ApiErrorCode = (typeof BACKEND_CODES)[number] | ClientCode;

const KNOWN_CODES: ReadonlySet<string> = new Set<string>(BACKEND_CODES);

const SESSION_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHENTICATED', 'ACCOUNT_DISABLED']);

/** Errores que no pertenecen a ningún formulario: se avisan de forma global (toast). */
const GLOBAL_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'NETWORK_ERROR',
  'SERVER_UNAVAILABLE',
  'INTERNAL_ERROR',
  'ACCESS_DENIED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'UNAUTHENTICATED',
]);

const MESSAGES = {
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unavailable: 'El servidor no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  internal: 'Ocurrió un error inesperado en el servidor. Inténtalo de nuevo.',
  unauthenticated: 'Debes iniciar sesión para continuar.',
  forbidden: 'No tienes permisos para realizar esta acción.',
  notFound: 'El recurso solicitado no existe.',
  badRequest: 'La solicitud no es válida.',
  conflict: 'La operación entra en conflicto con el estado actual de los datos.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
} as const;

/** Error de una llamada a la API, normalizado: lo que el resto de la app maneja en lugar de `HttpErrorResponse`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    /** Primer mensaje de error de cada campo (solo en `VALIDATION_FAILED`). */
    readonly fieldErrors: Readonly<Record<string, string>> = {},
    /** Identificador para correlacionar el error con el log del servidor. */
    readonly traceId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** La sesión no sirve (falta, venció o es inválida): hay que volver a iniciar sesión. */
  get isSessionProblem(): boolean {
    return SESSION_CODES.has(this.code);
  }

  /** No pertenece a un formulario concreto: corresponde un aviso global. */
  get isGlobal(): boolean {
    return GLOBAL_CODES.has(this.code);
  }
}

/** Convierte cualquier fallo de una llamada HTTP (o ya normalizado) en un `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) return new ApiError(0, 'UNKNOWN', MESSAGES.unknown);

  const { status } = error;
  if (status === 0) return new ApiError(0, 'NETWORK_ERROR', MESSAGES.network);

  const body = isRecord(error.error) ? error.error : null;
  const message = body && typeof body['message'] === 'string' && body['message'].trim() !== '' ? body['message'] : null;
  const code = typeof body?.['code'] === 'string' && KNOWN_CODES.has(body['code']) ? (body['code'] as ApiErrorCode) : null;
  const traceId = typeof body?.['traceId'] === 'string' ? body['traceId'] : null;

  // Un proxy caído (nginx) responde con HTML, nunca con el contrato: mensaje propio.
  if ([502, 503, 504].includes(status) && !code) {
    return new ApiError(status, 'SERVER_UNAVAILABLE', MESSAGES.unavailable, {}, traceId);
  }

  const fallback = fallbackFor(status);
  return new ApiError(
    status,
    code ?? fallback.code,
    message ?? fallback.message,
    toFieldErrors(body?.['fieldErrors']),
    traceId,
  );
}

function fallbackFor(status: number): { code: ApiErrorCode; message: string } {
  if (status === 401) return { code: 'UNAUTHENTICATED', message: MESSAGES.unauthenticated };
  if (status === 403) return { code: 'ACCESS_DENIED', message: MESSAGES.forbidden };
  if (status === 404) return { code: 'RESOURCE_NOT_FOUND', message: MESSAGES.notFound };
  if (status === 409) return { code: 'UNKNOWN', message: MESSAGES.conflict };
  if (status === 400 || status === 422) return { code: 'UNKNOWN', message: MESSAGES.badRequest };
  if (status >= 500) return { code: 'INTERNAL_ERROR', message: MESSAGES.internal };
  return { code: 'UNKNOWN', message: MESSAGES.unknown };
}

function toFieldErrors(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!Array.isArray(value)) return result;
  for (const item of value as unknown[]) {
    if (!isRecord(item)) continue;
    const field = item['field'];
    const message = item['message'];
    if (typeof field === 'string' && typeof message === 'string' && !(field in result)) result[field] = message;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
