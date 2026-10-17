import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { isRole, type Role } from '@core/auth/roles/role';

type UserResponse = components['schemas']['UserResponse'];
type RoleResponse = components['schemas']['RoleResponse'];

/** Usuario con los campos que la app necesita siempre presentes (el OpenAPI los marca todos como opcionales). */
export interface AppUser {
  readonly id: number;
  readonly nombre: string;
  readonly email: string;
  readonly rol: Role;
  readonly sucursalId: number | null;
  readonly activo: boolean;
}

/** Rol asignable (para el select del formulario). */
export interface RoleOption {
  readonly id: number;
  readonly nombre: Role;
}

/** Datos del formulario de usuario. */
export interface UserInput {
  readonly nombre: string;
  readonly email: string;
  /** Vacía en edición = no cambiar la contraseña. */
  readonly password: string;
  readonly rolId: number;
  /** `null` para ADMIN (sin sucursal) o cuando el servidor la fija (MANAGER). */
  readonly sucursalId: number | null;
  /** Solo en edición. */
  readonly activo?: boolean;
}

function toUser(raw: UserResponse): AppUser | null {
  const rol = raw.role?.nombre;
  // Sin id, correo o un rol que la app conozca no se puede mostrar ni gestionar con seguridad: se descarta.
  if (typeof raw.id !== 'number' || !raw.email || !isRole(rol)) return null;
  return {
    id: raw.id,
    nombre: raw.nombre?.trim() || raw.email,
    email: raw.email.trim(),
    rol,
    sucursalId: raw.sucursalId ?? null,
    activo: raw.activo !== false,
  };
}

function requireUser(raw: UserResponse): AppUser {
  const user = toUser(raw);
  if (!user) throw new Error('El servidor devolvió un usuario incompleto.');
  return user;
}

function toRequest(input: UserInput): components['schemas']['UserRequest'] {
  const password = input.password;
  return {
    nombre: input.nombre.trim(),
    email: input.email.trim(),
    rolId: input.rolId,
    ...(password ? { password } : {}),
    ...(input.sucursalId !== null ? { sucursalId: input.sucursalId } : {}),
    ...(input.activo !== undefined ? { activo: input.activo } : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private get options() {
    // Las pantallas muestran el error en su propio formulario, diálogo o tabla: sin aviso global duplicado.
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** El backend ya limita el listado al alcance de quien consulta (ADMIN: todos; MANAGER: su sucursal). */
  list(): Observable<AppUser[]> {
    return this.http
      .get<UserResponse[]>(`${this.baseUrl}/api/users`, this.options)
      .pipe(map((items) => items.map(toUser).filter((user): user is AppUser => user !== null)));
  }

  create(input: UserInput): Observable<AppUser> {
    return this.http.post<UserResponse>(`${this.baseUrl}/api/users`, toRequest(input), this.options).pipe(map(requireUser));
  }

  update(id: number, input: UserInput): Observable<AppUser> {
    return this.http.put<UserResponse>(`${this.baseUrl}/api/users/${id}`, toRequest(input), this.options).pipe(map(requireUser));
  }

  /** "Desactivar": el backend no borra al usuario, lo marca como inactivo. */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/users/${id}`, this.options);
  }

  /** Roles que quien consulta puede asignar (ADMIN: todos; MANAGER: solo los inferiores). */
  roles(): Observable<RoleOption[]> {
    return this.http.get<RoleResponse[]>(`${this.baseUrl}/api/roles`, this.options).pipe(
      map((items) =>
        items.flatMap((role) => (typeof role.id === 'number' && isRole(role.nombre) ? [{ id: role.id, nombre: role.nombre }] : [])),
      ),
    );
  }
}
