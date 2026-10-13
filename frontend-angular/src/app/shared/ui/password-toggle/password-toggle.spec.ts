import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordToggle } from './password-toggle';

describe('PasswordToggle', () => {
  it('empieza oculto y ofrece mostrar la contraseña', async () => {
    await render('<app-password-toggle />', { imports: [PasswordToggle] });
    const button = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('al pulsar alterna el estado y su etiqueta', async () => {
    await render('<app-password-toggle />', { imports: [PasswordToggle] });
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    const button = screen.getByRole('button', { name: 'Ocultar contraseña' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
  });

  it('sincroniza el estado con el padre mediante two-way binding', async () => {
    await render(
      `<app-password-toggle [(visible)]="visible" />
       <input [type]="visible ? 'text' : 'password'" aria-label="Clave" />`,
      { imports: [PasswordToggle], componentProperties: { visible: false } },
    );
    expect(screen.getByLabelText('Clave')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Clave')).toHaveAttribute('type', 'text');
  });

  it('nunca envía el formulario que lo contiene', async () => {
    await render('<form><app-password-toggle /></form>', { imports: [PasswordToggle] });
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
