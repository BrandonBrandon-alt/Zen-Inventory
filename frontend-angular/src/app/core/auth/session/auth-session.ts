/** Sesión autenticada. A diferencia del OpenAPI (todo opcional), aquí todo es obligatorio salvo sucursalId. */
export interface AuthSession {
  token: string;
  email: string;
  nombre: string;
  rol: string;
  id: number;
  sucursalId?: number;
  /** Versión de la foto de perfil (cuándo cambió); ausente si no tiene foto. Sirve para pedirla de nuevo al cambiar. */
  avatarVersion?: string;
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['token'] === 'string' &&
    v['token'].length > 0 &&
    typeof v['email'] === 'string' &&
    typeof v['nombre'] === 'string' &&
    typeof v['rol'] === 'string' &&
    typeof v['id'] === 'number' &&
    (v['sucursalId'] === undefined || typeof v['sucursalId'] === 'number') &&
    (v['avatarVersion'] === undefined || typeof v['avatarVersion'] === 'string')
  );
}
