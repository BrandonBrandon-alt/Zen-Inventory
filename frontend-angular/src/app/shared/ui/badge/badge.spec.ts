import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('muestra su texto', async () => {
    await render('<app-badge>Activa</app-badge>', { imports: [Badge] });
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it.each([
    ['success', 'text-success'],
    ['danger', 'text-brand-soft'],
    ['warning', 'text-warning'],
    ['info', 'text-info'],
    ['neutral', 'text-fg-subtle'],
  ])('la variante %s usa su color', async (variant, cls) => {
    await render(`<app-badge variant="${variant}">X</app-badge>`, { imports: [Badge] });
    expect(screen.getByText('X')).toHaveClass(cls);
  });

  it('el punto es decorativo: no se anuncia a los lectores de pantalla', async () => {
    const { container } = await render('<app-badge dot>Activa</app-badge>', { imports: [Badge] });
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('sin dot no dibuja el punto', async () => {
    const { container } = await render('<app-badge>Activa</app-badge>', { imports: [Badge] });
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
