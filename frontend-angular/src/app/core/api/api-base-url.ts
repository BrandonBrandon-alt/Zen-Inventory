import { InjectionToken } from '@angular/core';

/**
 * Prefijo de todas las rutas del backend. Vacío = mismo origen: en desarrollo lo
 * resuelve el proxy (proxy.conf.js) y en producción el servidor web (nginx).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});
