import { type Signal, computed, effect, linkedSignal, signal, untracked } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';
import { toApiError } from '@core/api/api-error';

export interface SortState {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

/** Lo que recibe `fetch`: los filtros más la página (desde 1), el tamaño y el orden elegido en la tabla. */
export type PagedQuery<F> = F & { readonly page: number; readonly size: number; readonly sort: SortState | null };

/** Una página que devuelve el servidor; puede traer más datos (totales del filtro), que quedan en `last()`. */
export interface ServerPage<R> {
  readonly rows: readonly R[];
  readonly total: number;
}

/**
 * Lista paginada en el servidor, igual en todas las pantallas: pide la página al cambiar filtros (vuelve a la 1), orden o
 * página; solo aplica la última respuesta pedida (una lenta no pisa a la nueva); y deja filas, total, carga y error como
 * señales para la tabla. Llamar en contexto de inyección.
 */
export function serverPagedList<F, P extends ServerPage<unknown>>(options: {
  readonly filters: Signal<F>;
  readonly sort?: Signal<SortState | null>;
  readonly size: number;
  readonly fetch: (query: PagedQuery<F>) => Observable<P>;
}) {
  const page = linkedSignal<unknown, number>({ source: options.filters, computation: () => 1 });
  const query = computed<PagedQuery<F>>(() => ({ ...options.filters(), page: page(), size: options.size, sort: options.sort?.() ?? null }));
  const last = signal<P | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);
  let requestId = 0;

  async function load(silent: boolean, current: PagedQuery<F>): Promise<void> {
    const id = ++requestId;
    if (!silent) loading.set(true);
    error.set(null);
    try {
      const result = await firstValueFrom(options.fetch(current));
      if (id === requestId) last.set(result);
    } catch (e) {
      if (id === requestId) error.set(toApiError(e).message);
    } finally {
      if (id === requestId) loading.set(false);
    }
  }

  effect(() => {
    const current = query();
    untracked(() => void load(false, current));
  });

  return {
    rows: computed<P['rows']>(() => last()?.rows ?? []),
    total: computed(() => last()?.total ?? 0),
    last: last.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    page,
    query,
    /** Vuelve a pedir la página actual (tras una acción); `silent` no muestra la carga en la tabla. */
    reload: (silent = false): Promise<void> => load(silent, untracked(query)),
  };
}

export type ServerPagedList<P extends ServerPage<unknown>> = ReturnType<typeof serverPagedList<unknown, P>>;
