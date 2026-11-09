import { afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, type ParamMap, Router } from '@angular/router';

/**
 * Enlace que abre directamente el formulario de un documento nuevo (orden de compra o traslado) con el producto y la
 * sucursal ya elegidos. Lo usa el ajuste de stock: un ingreso por compra o un traslado no se registran ahí, así que el
 * diálogo lleva a la pantalla correspondiente con el formulario abierto en vez de dejar a la persona empezar de cero.
 *
 *   /purchases?nuevo=1&producto=12&sucursal=3
 *   /transfers?nuevo=1&producto=12&sucursal=3&lado=destino
 */
export interface NewDocumentRequest {
  readonly productId: number | null;
  readonly branchId: number | null;
  /** En un traslado, qué papel cumple `branchId`: la sucursal que recibe (destino) o la que envía (origen). */
  readonly side: 'origen' | 'destino' | null;
}

export function newDocumentUrl(path: string, request: NewDocumentRequest): string {
  const params = new URLSearchParams({ nuevo: '1' });
  if (request.productId !== null) params.set('producto', String(request.productId));
  if (request.branchId !== null) params.set('sucursal', String(request.branchId));
  if (request.side !== null) params.set('lado', request.side);
  return `${path}?${params.toString()}`;
}

/** La petición que trae la URL, o `null` si no pide abrir el formulario. Los valores que no son ids válidos se ignoran. */
export function readNewDocumentRequest(params: ParamMap): NewDocumentRequest | null {
  if (params.get('nuevo') !== '1') return null;
  const side = params.get('lado');
  return {
    productId: positiveId(params.get('producto')),
    branchId: positiveId(params.get('sucursal')),
    side: side === 'origen' || side === 'destino' ? side : null,
  };
}

function positiveId(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/**
 * Para la pantalla que recibe el enlace (llamar en el constructor): devuelve la petición, si la hay, y quita sus
 * parámetros de la URL sin agregar una entrada al historial, para que recargar o volver atrás no reabra el formulario.
 */
export function takeNewDocumentRequest(): NewDocumentRequest | null {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const request = readNewDocumentRequest(route.snapshot.queryParamMap);
  if (request) {
    // Después del primer render: en el constructor todavía está en curso la navegación que creó la pantalla.
    afterNextRender(() => {
      void router.navigate([], {
        relativeTo: route,
        queryParams: { nuevo: null, producto: null, sucursal: null, lado: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }
  return request;
}
