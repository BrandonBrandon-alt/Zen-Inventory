import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { type PagedQuery, type ServerPage, serverPagedList } from './server-paged-list';

interface Filters {
  readonly status: string;
}

function setup(fetch: (q: PagedQuery<Filters>) => Observable<ServerPage<string> & Record<string, unknown>>) {
  const filters = signal<Filters>({ status: 'open' });
  const sort = signal<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const list = TestBed.runInInjectionContext(() => serverPagedList<Filters, ServerPage<string> & Record<string, unknown>>({ filters, sort, size: 15, fetch }));
  TestBed.tick();
  return { list, filters, sort };
}

describe('serverPagedList', () => {
  it('pide la página 1 con los filtros, el tamaño y el orden', async () => {
    const fetch = vi.fn(() => of({ rows: ['a', 'b'], total: 40 }));
    const { list } = setup(fetch);
    expect(fetch).toHaveBeenCalledWith({ status: 'open', page: 1, size: 15, sort: null });
    await vi.waitFor(() => expect(list.rows()).toEqual(['a', 'b']));
    expect(list.total()).toBe(40);
    expect(list.loading()).toBe(false);
  });

  it('cambiar un filtro vuelve a la página 1; cambiar el orden pide de nuevo', () => {
    const fetch = vi.fn(() => of({ rows: [], total: 40 }));
    const { list, filters, sort } = setup(fetch);
    list.page.set(3);
    TestBed.tick();
    expect(fetch).toHaveBeenLastCalledWith({ status: 'open', page: 3, size: 15, sort: null });
    filters.set({ status: 'all' });
    TestBed.tick();
    expect(fetch).toHaveBeenLastCalledWith({ status: 'all', page: 1, size: 15, sort: null });
    sort.set({ key: 'total', direction: 'asc' });
    TestBed.tick();
    expect(fetch).toHaveBeenLastCalledWith({ status: 'all', page: 1, size: 15, sort: { key: 'total', direction: 'asc' } });
  });

  it('solo aplica la última respuesta aunque la anterior llegue después', () => {
    const first = new Subject<{ rows: string[]; total: number }>();
    const second = new Subject<{ rows: string[]; total: number }>();
    const fetch = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { list } = setup(fetch);
    list.page.set(2);
    TestBed.tick();
    second.next({ rows: ['nueva'], total: 1 });
    second.complete();
    first.next({ rows: ['vieja'], total: 9 });
    first.complete();
    return vi.waitFor(() => {
      expect(list.rows()).toEqual(['nueva']);
      expect(list.total()).toBe(1);
    });
  });

  it('un error queda en error() y deja de cargar', async () => {
    const fetch = vi.fn(() => throwError(() => new Error('sin red')));
    const { list } = setup(fetch);
    await vi.waitFor(() => expect(list.error()).toBeTruthy());
    expect(list.loading()).toBe(false);
  });

  it('reload vuelve a pedir la misma página sin mostrar carga si es silenciosa, y expone la última respuesta', async () => {
    const fetch = vi.fn(() => of({ rows: ['a'], total: 1, extra: 7 }));
    const { list } = setup(fetch);
    await list.reload(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(list.last()).toEqual({ rows: ['a'], total: 1, extra: 7 });
  });
});
