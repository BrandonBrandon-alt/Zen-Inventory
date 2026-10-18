import { describe, expect, it } from 'vitest';
import { ROLES } from '@core/auth/roles/role';
import { NAV_SECTIONS, navSectionsFor } from './nav-items';

const labels = (role: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(role).flatMap((section) => section.items.map((item) => item.label));

const allItems = NAV_SECTIONS.flatMap((section) => section.items);

describe('NAV_SECTIONS', () => {
  it('no repite rutas', () => {
    const paths = allItems.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('todas las rutas empiezan por / y tienen al menos un rol', () => {
    for (const item of allItems) {
      expect(item.path.startsWith('/')).toBe(true);
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });

  it('el Panel es accesible para todos los roles (destino de las redirecciones de guarda)', () => {
    const dashboard = allItems.find((item) => item.path === '/dashboard');
    expect([...(dashboard?.roles ?? [])].sort()).toEqual([...ROLES].sort());
  });
});

describe('descripciones del menú', () => {
  it('cada pantalla dice para qué sirve, en una frase corta que termina en punto o puntos suspensivos', () => {
    for (const item of allItems) {
      expect(item.description.length, item.label).toBeGreaterThan(15);
      expect(item.description.length, item.label).toBeLessThanOrEqual(90);
      expect(item.description, item.label).toMatch(/[.…]$/);
    }
  });

  it('no hay dos pantallas con la misma descripción', () => {
    const texts = allItems.map((item) => item.description);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('navSectionsFor', () => {
  it('ADMIN ve todo, incluidos los maestros', () => {
    expect(labels('ADMIN')).toEqual(allItems.map((item) => item.label));
    expect(navSectionsFor('ADMIN').map((section) => section.title)).toEqual(['Navegación', 'Maestros']);
  });

  it('OPERADOR_INVENTARIO solo ve las pantallas operativas', () => {
    expect(labels('OPERADOR_INVENTARIO')).toEqual([
      'Panel',
      'Inventario',
      'Alertas',
      'Traslados',
      'Compras',
      'Ventas',
      'Historial Ventas',
      'Devoluciones',
    ]);
    expect(navSectionsFor('OPERADOR_INVENTARIO').map((section) => section.title)).toEqual(['Navegación']);
  });

  it.each(['MANAGER', 'SELLER'] as const)('%s no ve ningún maestro', (role) => {
    expect(labels(role)).not.toContain('Productos');
    expect(navSectionsFor(role).map((section) => section.title)).toEqual(['Navegación']);
  });

  it.each(['Traslados', 'Compras'])('%s es de ADMIN, MANAGER y OPERADOR_INVENTARIO (el backend responde 403 al vendedor)', (label) => {
    for (const role of ['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO'] as const) expect(labels(role)).toContain(label);
    expect(labels('SELLER')).not.toContain(label);
  });

  it('Alertas es de ADMIN, MANAGER y OPERADOR_INVENTARIO (el backend responde 403 al vendedor)', () => {
    for (const role of ['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO'] as const) expect(labels(role)).toContain('Alertas');
    expect(labels('SELLER')).not.toContain('Alertas');
  });

  it('sin rol no muestra nada', () => {
    expect(navSectionsFor(null)).toEqual([]);
  });

  it('Usuarios es de ADMIN y MANAGER (el backend responde 403 al resto)', () => {
    expect(labels('ADMIN')).toContain('Usuarios');
    expect(labels('MANAGER')).toContain('Usuarios');
    for (const role of ['SELLER', 'OPERADOR_INVENTARIO'] as const) {
      expect(labels(role)).not.toContain('Usuarios');
    }
  });

  it('Sucursales es solo de ADMIN (la página y las acciones del backend lo exigen)', () => {
    expect(labels('ADMIN')).toContain('Sucursales');
    for (const role of ['MANAGER', 'SELLER', 'OPERADOR_INVENTARIO'] as const) {
      expect(labels(role)).not.toContain('Sucursales');
    }
  });
});
