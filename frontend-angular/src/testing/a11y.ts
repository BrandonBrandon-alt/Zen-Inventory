import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Falla si axe-core encuentra problemas de accesibilidad en `root` (nombres de botones y campos, roles ARIA, etiquetas,
 * jerarquía de encabezados…). Sin contraste de color ni "regiones": jsdom no calcula estilos ni diseño, eso se
 * revisa en el navegador.
 */
export async function expectAccessible(root: Element = document.body): Promise<void> {
  const { violations } = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    resultTypes: ['violations'],
  });
  // Un solo texto (no una lista) para que el mensaje del fallo diga qué regla y qué elementos.
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`).join('\n');
  expect(report).toBe('');
}
