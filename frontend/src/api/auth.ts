import { apiClient } from "./client";

const AUTH_TOKEN_KEY = "zen_inventory_token";
const AUTH_EMAIL_KEY = "zen_inventory_email";
const AUTH_NAME_KEY  = "zen_inventory_nombre";
const AUTH_ROLE_KEY      = "zen_inventory_rol";
const AUTH_BRANCH_ID_KEY = "zen_inventory_sucursal_id";
const AUTH_USER_ID_KEY   = "zen_inventory_user_id";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  email: string;
  nombre: string;
  rol: string;
  id: number;
  sucursalId?: number;
}

/**
 * Realiza el Login contra el Backend Zen Inventory.
 * Retorna la sesión (token + email) o lanza un error con mensaje legible.
 */
export async function login(payload: LoginPayload): Promise<AuthSession> {
  const { data, error } = (await apiClient.POST("/api/auth/login", {
    body: payload,
  })) as any;

  if (error || !data?.token || !data?.email) {
    throw new Error("Credenciales incorrectas. Inténtalo de nuevo.");
  }

  // Persiste en localStorage para navegaciones futuras
  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_EMAIL_KEY, data.email);
  localStorage.setItem(AUTH_NAME_KEY,  data.nombre || "");
  localStorage.setItem(AUTH_ROLE_KEY,  data.rol || "");
  if (data.sucursalId) {
    localStorage.setItem(AUTH_BRANCH_ID_KEY, data.sucursalId.toString());
  }
  if (data.id) {
    localStorage.setItem(AUTH_USER_ID_KEY, data.id.toString());
  }

  return { 
    token:  data.token, 
    email:  data.email, 
    nombre: data.nombre || "", 
    rol:    data.rol || "",
    id:     data.id,
    sucursalId: data.sucursalId
  };
}

/** Elimina la sesión activa (Logout) */
export function logout(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
  localStorage.removeItem(AUTH_NAME_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_BRANCH_ID_KEY);
  localStorage.removeItem(AUTH_USER_ID_KEY);
}

/** Recupera la sesión guardada, o null si no hay ninguna */
export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null; // SSR safe
  const token  = localStorage.getItem(AUTH_TOKEN_KEY);
  const email  = localStorage.getItem(AUTH_EMAIL_KEY);
  const nombre = localStorage.getItem(AUTH_NAME_KEY);
  const rol    = localStorage.getItem(AUTH_ROLE_KEY);
  const branchId = localStorage.getItem(AUTH_BRANCH_ID_KEY);
  const userId   = localStorage.getItem(AUTH_USER_ID_KEY);
  if (!token || !email || !userId) return null;
  return { 
    token, 
    email, 
    nombre: nombre || "", 
    rol:    rol || "",
    id:     parseInt(userId, 10),
    sucursalId: branchId ? parseInt(branchId, 10) : undefined
  };
}
