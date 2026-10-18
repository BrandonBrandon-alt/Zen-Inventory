import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS } from './layout/nav-items';
import { SCREENS } from './app.routes';

describe('rutas del menú', () => {
  const items = NAV_SECTIONS.flatMap((section) => section.items);

  it('cada ítem del menú tiene su pantalla', () => {
    for (const item of items) expect(SCREENS[item.path], `${item.label} (${item.path})`).toBeTypeOf('function');
  });

  it('no hay pantallas sin ítem en el menú (rutas huérfanas)', () => {
    const paths = new Set(items.map((item) => item.path));
    for (const path of Object.keys(SCREENS)) expect(paths.has(path), path).toBe(true);
  });

  it('cada pantalla se puede cargar y es un componente', async () => {
    for (const [path, load] of Object.entries(SCREENS)) expect(await load(), path).toBeTypeOf('function');
  });
});
