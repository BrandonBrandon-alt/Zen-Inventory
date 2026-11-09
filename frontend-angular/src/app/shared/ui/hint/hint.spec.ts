import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetTooltipGroup } from '../tooltip/tooltip';
import { Hint } from './hint';

const TEXT = 'Lo que se vende en promedio en cada venta.';

async function setup() {
  await render(`<p>Valor promedio <app-hint label="Valor promedio" text="${TEXT}" /></p>`, { imports: [Hint] });
  return screen.getByRole('button', { name: 'Qué significa: Valor promedio' });
}

describe('Hint', () => {
  beforeEach(() => resetTooltipGroup());

  it('es un botón enfocable que se anuncia con el nombre del dato', async () => {
    const button = await setup();
    await userEvent.tab();
    expect(button).toHaveFocus();
  });

  it('al pasar el cursor explica el dato y al salir se oculta', async () => {
    const button = await setup();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT);
    await userEvent.unhover(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('con el teclado aparece al enfocar, describe al botón y Escape la cierra', async () => {
    const button = await setup();
    await userEvent.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(TEXT);
    expect(button).toHaveAccessibleDescription(TEXT);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
