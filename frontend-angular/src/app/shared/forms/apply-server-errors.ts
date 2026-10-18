import type { FormGroup } from '@angular/forms';

/** Clave del error de validación que representa "el servidor rechazó este valor". */
export const SERVER_ERROR_KEY = 'server';

/**
 * Marca en el formulario los errores por campo que devolvió el backend (`fieldErrors`).
 * Devuelve los campos que sí existen en el formulario; los demás debe mostrarlos quien llama (p. ej. en un aviso).
 * El error desaparece solo cuando el usuario cambia el valor del campo.
 */
export function applyServerErrors(form: FormGroup, fieldErrors: Readonly<Record<string, string>>): string[] {
  const applied: string[] = [];
  for (const [field, message] of Object.entries(fieldErrors)) {
    const control = form.get(field);
    if (!control) continue;
    control.setErrors({ [SERVER_ERROR_KEY]: message });
    control.markAsTouched();
    applied.push(field);
  }
  return applied;
}
