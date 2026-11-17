import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Texto de un buscador que pide al servidor: `text` sigue cada tecla (lo que se ve en el campo) y `term` se actualiza,
 * recortado, recién cuando se deja de escribir, para no pedir una página por cada letra. Llamar en contexto de inyección.
 */
export function debouncedText(delayMs = 300) {
  const text = signal('');
  const term = signal('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  return {
    text: text.asReadonly(),
    term: term.asReadonly(),
    set(value: string): void {
      text.set(value);
      clearTimeout(timer);
      timer = setTimeout(() => term.set(value.trim()), delayMs);
    },
    clear(): void {
      clearTimeout(timer);
      text.set('');
      term.set('');
    },
  };
}

export type DebouncedText = ReturnType<typeof debouncedText>;
