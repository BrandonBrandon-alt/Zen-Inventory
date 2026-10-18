import { Injectable, computed, signal } from '@angular/core';
import { type AuthSession, isAuthSession } from './auth-session';
import { type Role, isRole } from '../roles/role';

export const SESSION_STORAGE_KEY = 'zen_inventory_session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null): void {
  try {
    if (session === null) localStorage.removeItem(SESSION_STORAGE_KEY);
    else localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Almacenamiento no disponible: la sesión sigue viva solo en memoria.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly state = signal<AuthSession | null>(readStoredSession());

  readonly session = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly token = computed(() => this.state()?.token ?? null);

  /** Rol de la sesión si es uno de los que la app conoce; null si no hay sesión o el rol es desconocido. */
  readonly role = computed<Role | null>(() => {
    const rol = this.state()?.rol;
    return isRole(rol) ? rol : null;
  });

  start(session: AuthSession): void {
    this.state.set(session);
    writeStoredSession(session);
  }

  /** Actualiza los datos de la sesión que el usuario puede cambiar desde su perfil, sin volver a iniciar sesión. */
  update(changes: Partial<Pick<AuthSession, 'nombre' | 'avatarVersion'>>): void {
    const current = this.state();
    if (current === null) return;
    const next = { ...current, ...changes };
    this.state.set(next);
    writeStoredSession(next);
  }

  clear(): void {
    this.state.set(null);
    writeStoredSession(null);
  }
}
