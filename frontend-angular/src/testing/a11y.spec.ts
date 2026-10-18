import { describe, expect, it } from 'vitest';
import { expectAccessible } from './a11y';

describe('expectAccessible', () => {
  it('acepta un documento accesible', async () => {
    document.body.innerHTML = '<main><h1>Título</h1><button type="button">Guardar</button><label>Nombre <input /></label></main>';
    await expectAccessible();
  });

  it('detecta un botón sin nombre y un campo sin etiqueta (si no, las pruebas de accesibilidad pasarían siempre)', async () => {
    document.body.innerHTML = '<main><h1>Título</h1><button type="button"></button><input /></main>';
    await expect(expectAccessible()).rejects.toThrow(/button-name|label/);
  });
});
