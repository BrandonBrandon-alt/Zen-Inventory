"use client";

import { useState, useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * usePrint — imprime un componente React aislado en un iframe,
 * evitando que el diálogo de impresión capture el dashboard completo.
 */
export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback((element: React.ReactElement) => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      // Renderizar el componente a HTML estático
      const markup = renderToStaticMarkup(element);

      // Crear iframe oculto
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "80mm";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        setIsPrinting(false);
        return;
      }

      // Escribir HTML completo con CSS de impresión incluido
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Factura de Venta - Zen Inventory</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: white;
                color: black;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: 80mm auto;
                margin: 4mm;
              }
            </style>
          </head>
          <body>
            ${markup}
          </body>
        </html>
      `);
      doc.close();

      // Esperar a que el iframe cargue (incluyendo fuentes si están disponibles)
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          // Limpiar después de un tiempo prudencial
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            setIsPrinting(false);
          }, 1000);
        }
      };
    } catch (error) {
      console.error("Error durante la impresión:", error);
      setIsPrinting(false);
    }
  }, [isPrinting]);

  return { print, isPrinting };
}
