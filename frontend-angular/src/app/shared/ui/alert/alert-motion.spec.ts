import { render } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert (movimiento)', () => {
  it('todo mensaje entra con su animación sin que cada pantalla la pida', async () => {
    const { container } = await render('<app-alert>Falló</app-alert>', { imports: [Alert] });
    expect(container.querySelector('app-alert')).toHaveClass('animate-alert-in');
  });
});
