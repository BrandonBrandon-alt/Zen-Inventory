import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('por defecto es un error anunciado como alerta', async () => {
    await render('<app-alert>Credenciales incorrectas</app-alert>', { imports: [Alert] });
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales incorrectas');
  });

  it.each([
    ['danger', 'alert'],
    ['warning', 'alert'],
    ['success', 'status'],
    ['info', 'status'],
  ])('la variante %s se anuncia con el rol %s', async (variant, role) => {
    await render(`<app-alert variant="${variant}">Mensaje</app-alert>`, { imports: [Alert] });
    expect(screen.getByRole(role)).toHaveTextContent('Mensaje');
  });

  it.each([
    ['danger', 'text-danger'],
    ['warning', 'text-warning'],
    ['success', 'text-success'],
    ['info', 'text-info'],
  ])('la variante %s usa su color de estado', async (variant, colorClass) => {
    await render(`<app-alert variant="${variant}">Mensaje</app-alert>`, { imports: [Alert] });
    expect(screen.getByText('Mensaje').closest('[role]')).toHaveClass(colorClass);
  });
});
