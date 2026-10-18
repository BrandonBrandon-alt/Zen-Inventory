import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintService } from './print.service';

describe('PrintService', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('carga el documento en un iframe oculto, lo imprime y lo retira', async () => {
    const printed = vi.fn();
    // El iframe recarga su ventana al cargar `srcdoc`: se sustituye `print` justo antes de que corra su `load`.
    const patch = (event: Event) => {
      const win = (event.target as HTMLIFrameElement).contentWindow;
      if (win) win.print = printed;
    };
    document.addEventListener('load', patch, true);
    try {
      TestBed.inject(PrintService).print('<!doctype html><html><body><p>Hola</p></body></html>');
      const frame = document.querySelector('iframe') as HTMLIFrameElement;
      expect(frame.srcdoc).toContain('Hola');
      expect(frame).toHaveAttribute('aria-hidden', 'true');
      await vi.waitFor(() => expect(printed).toHaveBeenCalledTimes(1));
      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.waitFor(() => expect(document.querySelector('iframe')).toBeNull());
    } finally {
      document.removeEventListener('load', patch, true);
    }
  });
});
