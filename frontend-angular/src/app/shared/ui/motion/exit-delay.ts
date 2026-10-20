import { DestroyRef } from '@angular/core';
import { signal } from '@angular/core';

/** Cuánto dura la salida de un panel (ms): más corta y discreta que su entrada. */
export const EXIT_MS = 120;

/**
 * Mantiene un elemento en pantalla el tiempo justo para que se vea su salida antes de quitarlo. Quien lo usa pinta el
 * panel mientras `active()` sea verdadero (con su clase de salida) y retira el nodo en `done`.
 *
 * Sin movimiento no hay espera: si el navegador no sabe de `matchMedia` o la persona pidió menos movimiento, `done` corre
 * al instante y el panel desaparece como antes.
 */
export class ExitDelay {
  private readonly state = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** La salida está en curso: el panel sigue en pantalla, saliendo. */
  readonly active = this.state.asReadonly();

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.cancel());
  }

  begin(done: () => void): void {
    this.cancel();
    if (!ExitDelay.motionAllowed()) {
      done();
      return;
    }
    this.state.set(true);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      done();
      this.state.set(false);
    }, EXIT_MS);
  }

  /** Interrumpe la salida (p. ej. se volvió a abrir): el panel se queda donde está. */
  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.state.set(false);
  }

  private static motionAllowed(): boolean {
    if (typeof globalThis.matchMedia !== 'function') return false;
    return !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
