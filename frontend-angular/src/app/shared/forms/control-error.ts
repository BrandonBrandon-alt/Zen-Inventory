import type { AbstractControl } from '@angular/forms';
import { SERVER_ERROR_KEY } from './apply-server-errors';

/**
 * Mensaje de error de un control para mostrar bajo su campo, o `null` si no hay que mostrar ninguno.
 *
 * - Solo se muestra después de que el usuario tocó el campo (o intentó enviar el formulario).
 * - Un error devuelto por el servidor se muestra tal cual; si no, se usa el mensaje del primer validador fallido.
 */
export function controlError(control: AbstractControl, messages: Readonly<Record<string, string>>): string | null {
  if (!control.touched || !control.errors) return null;
  const fromServer: unknown = control.errors[SERVER_ERROR_KEY];
  if (typeof fromServer === 'string') return fromServer;
  const key = Object.keys(control.errors)[0];
  return messages[key] ?? null;
}
