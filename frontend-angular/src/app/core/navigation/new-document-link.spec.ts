import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { newDocumentUrl, readNewDocumentRequest } from './new-document-link';

const read = (url: string) => readNewDocumentRequest(convertToParamMap(Object.fromEntries(new URL(url, 'http://x').searchParams)));

describe('newDocumentUrl / readNewDocumentRequest', () => {
  it('lo que se escribe en la URL se lee igual', () => {
    const url = newDocumentUrl('/transfers', { productId: 12, branchId: 3, side: 'destino' });
    expect(url).toBe('/transfers?nuevo=1&producto=12&sucursal=3&lado=destino');
    expect(read(url)).toEqual({ productId: 12, branchId: 3, side: 'destino' });
  });

  it('omite lo que no se conoce', () => {
    const url = newDocumentUrl('/purchases', { productId: 7, branchId: null, side: null });
    expect(url).toBe('/purchases?nuevo=1&producto=7');
    expect(read(url)).toEqual({ productId: 7, branchId: null, side: null });
  });

  it('sin "nuevo=1" no pide abrir nada', () => {
    expect(read('/purchases?producto=7')).toBeNull();
    expect(read('/purchases')).toBeNull();
  });

  it('ignora ids y lados inválidos en vez de usarlos', () => {
    expect(read('/purchases?nuevo=1&producto=abc&sucursal=-2&lado=x')).toEqual({ productId: null, branchId: null, side: null });
    expect(read('/purchases?nuevo=1&producto=0&sucursal=1.5')).toEqual({ productId: null, branchId: null, side: null });
  });
});
