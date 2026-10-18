import { type Signal, computed, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { toApiError } from '@core/api/api-error';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Estado de una carga asíncrona (datos, estado y error) para una sección de pantalla. Cada sección tiene el suyo:
 * si una falla, las demás siguen mostrándose. Si se pide otra carga mientras la anterior no ha llegado, la
 * respuesta vieja se descarta.
 */
export class Loadable<T> {
  private readonly state = signal<{ status: LoadStatus; data: T | null; error: string | null }>({ status: 'idle', data: null, error: null });
  private requestId = 0;

  readonly status: Signal<LoadStatus> = computed(() => this.state().status);
  readonly data: Signal<T | null> = computed(() => this.state().data);
  readonly error: Signal<string | null> = computed(() => this.state().error);
  readonly loading: Signal<boolean> = computed(() => this.state().status === 'loading');

  /**
   * Carga desde un `Observable` que emite una vez. Con `silent` conserva los datos actuales mientras llega la nueva
   * respuesta (no vuelve al estado de carga).
   */
  load(source: Observable<T>, options: { silent?: boolean } = {}): void {
    const id = ++this.requestId;
    if (!options.silent) this.state.update((s) => ({ status: 'loading', data: s.data, error: null }));
    source.subscribe({
      next: (data) => {
        if (id === this.requestId) this.state.set({ status: 'ready', data, error: null });
      },
      error: (error: unknown) => {
        if (id === this.requestId) this.state.set({ status: 'error', data: null, error: toApiError(error).message });
      },
    });
  }
}
