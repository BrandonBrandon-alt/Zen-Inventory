/**
 * Convierte filas de texto a CSV: separador coma, comillas dobles para lo que lleve coma, comillas o saltos de línea,
 * y `\r\n` entre filas (lo que espera Excel). Una celda que empieza con `=`, `+`, `-` o `@` se prefija con un apóstrofo:
 * al abrir el archivo en una hoja de cálculo no se ejecuta como fórmula (inyección de fórmulas).
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (value: string | number | null | undefined): string => {
    let text = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Descarga un CSV con marca de orden de bytes (BOM): sin ella Excel muestra mal las tildes y la eñe. */
export function downloadCsv(filename: string, csv: string, doc: Document = document): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
