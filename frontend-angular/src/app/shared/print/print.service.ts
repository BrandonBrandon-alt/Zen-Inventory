import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Imprime un documento HTML completo aislado de la app: se carga en un iframe oculto para que el diálogo de impresión
 * no capture el panel (menú, tablas, tema oscuro). Es un servicio para poder sustituirlo en las pruebas.
 */
@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly document = inject(DOCUMENT);

  print(html: string): void {
    const frame = this.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;inset:auto auto 0 0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = html;
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        // `print()` bloquea mientras el diálogo está abierto; al volver ya se puede retirar el iframe.
        setTimeout(() => frame.remove(), 1000);
      }
    });
    this.document.body.appendChild(frame);
  }
}
