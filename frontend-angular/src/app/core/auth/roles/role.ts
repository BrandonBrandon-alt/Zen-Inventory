/** Roles del backend (`Role.java`). */
export const ROLES = ['ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
