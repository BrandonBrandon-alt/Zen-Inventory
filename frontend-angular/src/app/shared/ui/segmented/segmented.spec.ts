import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Segmented, type SegmentedOption } from './segmented';

const OPTIONS: SegmentedOption[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: '7 días' },
  { value: 'month', label: 'Este mes' },
];

@Component({ imports: [Segmented], template: `<app-segmented [(value)]="value" [options]="options" ariaLabel="Periodo" />` })
class Host {
  options = OPTIONS;
  value = signal('week');
}

async function setup() {
  const result = await render(Host);
  return result.fixture.componentInstance;
}
const radio = (name: string) => screen.getByRole('radio', { name });

describe('Segmented', () => {
  it('es un grupo con nombre y marca la opción elegida', async () => {
    await setup();
    expect(screen.getByRole('radiogroup', { name: 'Periodo' })).toBeInTheDocument();
    expect(radio('7 días')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Hoy')).toHaveAttribute('aria-checked', 'false');
  });

  it('solo la elegida entra en el orden de tabulación', async () => {
    await setup();
    expect(radio('7 días')).toHaveAttribute('tabindex', '0');
    expect(radio('Hoy')).toHaveAttribute('tabindex', '-1');
  });

  it('un clic cambia la opción y actualiza el modelo del padre', async () => {
    const host = await setup();
    await userEvent.click(radio('Este mes'));
    expect(host.value()).toBe('month');
    expect(radio('Este mes')).toHaveAttribute('aria-checked', 'true');
  });

  it('las flechas mueven la selección dando la vuelta, y llevan el foco', async () => {
    const host = await setup();
    radio('7 días').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(host.value()).toBe('month');
    expect(radio('Este mes')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(host.value()).toBe('today');
    await userEvent.keyboard('{ArrowLeft}');
    expect(host.value()).toBe('month');
  });
});
