import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, ThemeService } from '@core/theme/theme.service';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('en tema oscuro ofrece cambiar a claro', async () => {
    await render(ThemeToggle);
    expect(screen.getByRole('button', { name: 'Modo claro' })).toBeInTheDocument();
  });

  it('en tema claro ofrece cambiar a oscuro', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    await render(ThemeToggle);
    expect(screen.getByRole('button', { name: 'Modo oscuro' })).toBeInTheDocument();
  });

  it('al pulsar cambia el tema de toda la app, lo recuerda y actualiza su etiqueta', async () => {
    await render(ThemeToggle);
    await userEvent.click(screen.getByRole('button', { name: 'Modo claro' }));
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Modo oscuro' })).toBeInTheDocument();
  });

  it('la variante de icono no muestra texto visible', async () => {
    await render(ThemeToggle);
    expect(screen.queryByText('Modo claro')).not.toBeInTheDocument();
  });

  it('la variante de fila muestra el texto y puede ocultarlo conservando el nombre accesible', async () => {
    const { rerender } = await render(ThemeToggle, { inputs: { variant: 'row' } });
    expect(screen.getByText('Modo claro')).toBeInTheDocument();
    await rerender({ inputs: { variant: 'row', labelVisible: false } });
    expect(screen.queryByText('Modo claro')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modo claro' })).toBeInTheDocument();
  });

  it('dos interruptores en pantalla siempre muestran el mismo estado', async () => {
    await render(
      '<app-theme-toggle /><app-theme-toggle variant="row" />',
      { imports: [ThemeToggle] },
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Modo claro' })[0]);
    expect(screen.getAllByRole('button', { name: 'Modo oscuro' })).toHaveLength(2);
  });
});
