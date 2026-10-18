import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv, toCsv } from './csv';

describe('toCsv', () => {
  it('separa con comas y filas con salto de línea de Windows', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('entrecomilla lo que lleva coma, comillas o saltos de línea, y duplica las comillas', () => {
    expect(toCsv([['uno, dos', 'dice "hola"', 'línea\nnueva']])).toBe('"uno, dos","dice ""hola""","línea\nnueva"');
  });

  it('los números y los vacíos quedan tal cual', () => {
    expect(toCsv([[1500.5, null, undefined, 0]])).toBe('1500.5,,,0');
  });

  it('un texto que empieza como fórmula se neutraliza con un apóstrofo', () => {
    expect(toCsv([['=SUM(A1:A2)', '+1', '-2', '@x', 'normal']])).toBe("'=SUM(A1:A2),'+1,'-2,'@x,normal");
  });

  it('un número negativo no se confunde con una fórmula', () => {
    expect(toCsv([[-5]])).toBe('-5');
  });

  it('sin filas da un texto vacío', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea un enlace temporal con el nombre pedido, lo pulsa y libera la URL', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download}|${this.href}`);
    });
    downloadCsv('auditoria.csv', 'a,b');
    expect(clicks).toEqual(['auditoria.csv|blob:csv']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    expect(document.querySelector('a[download]')).toBeNull(); // no deja el enlace en la página
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    // `Blob.text()` descarta la marca al decodificar: se comprueba en los bytes del archivo.
    const bytes = [...new Uint8Array(await blob.arrayBuffer())];
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('a,b');
  });
});
