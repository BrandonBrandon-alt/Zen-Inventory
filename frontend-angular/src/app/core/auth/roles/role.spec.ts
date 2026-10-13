import { describe, expect, it } from 'vitest';
import { ROLES, isRole } from './role';

describe('isRole', () => {
  it.each(ROLES)('reconoce %s', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([['admin'], ['INVENTADO'], [''], [null], [undefined], [5], [{}]])(
    'rechaza %j',
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );

  it('contempla los cuatro roles del backend', () => {
    expect([...ROLES].sort()).toEqual(['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO', 'SELLER']);
  });
});
