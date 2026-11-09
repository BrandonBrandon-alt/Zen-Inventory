import { signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('es una casilla real con el texto como nombre accesible y se marca al pulsar el texto o con el teclado', async () => {
    const checked = signal(false);
    await render('<app-checkbox [(checked)]="value">Solo sin mínimo definido</app-checkbox>', {
      imports: [Checkbox],
      componentProperties: { value: checked },
    });
    const box = screen.getByRole('checkbox', { name: 'Solo sin mínimo definido' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Solo sin mínimo definido'));
    expect(box).toBeChecked();
    expect(checked()).toBe(true);
    box.focus();
    await userEvent.keyboard(' ');
    expect(box).not.toBeChecked();
    expect(checked()).toBe(false);
  });

  it('sin texto usa ariaLabel como nombre', async () => {
    await render('<app-checkbox ariaLabel="Preferido" />', { imports: [Checkbox] });
    expect(screen.getByRole('checkbox', { name: 'Preferido' })).toBeInTheDocument();
  });

  it('funciona con formularios reactivos: lee el valor, lo escribe y respeta deshabilitado', async () => {
    const control = new FormControl(true, { nonNullable: true });
    await render('<app-checkbox [formControl]="control">Usuario activo</app-checkbox>', {
      imports: [Checkbox, ReactiveFormsModule],
      componentProperties: { control },
    });
    const box = screen.getByRole('checkbox', { name: 'Usuario activo' });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(control.value).toBe(false);
    control.setValue(true);
    expect(await screen.findByRole('checkbox', { name: 'Usuario activo' })).toBeChecked();
    control.disable();
    expect(await screen.findByRole('checkbox', { name: 'Usuario activo' })).toBeDisabled();
  });

  it('marcada se pinta con el color de la marca y la marca de verificación queda trazada', async () => {
    const { container } = await render('<app-checkbox [checked]="true">Sí</app-checkbox>', { imports: [Checkbox] });
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveClass('bg-brand');
    expect(container.querySelector('path')).toHaveAttribute('stroke-dashoffset', '0');
  });
});
