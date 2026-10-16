import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { FormField, InputDirective } from './form-field';

const imports = [FormField, InputDirective];

describe('FormField', () => {
  it('asocia la etiqueta con el input (se puede localizar por su etiqueta)', async () => {
    await render('<app-form-field label="Correo"><input appInput /></app-form-field>', { imports });
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
  });

  it('sin error no marca el input como inválido ni muestra alertas', async () => {
    await render('<app-form-field label="Correo"><input appInput /></app-form-field>', { imports });
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con error muestra el mensaje como alerta y marca el input inválido describiéndolo', async () => {
    await render(
      '<app-form-field label="Correo" error="Correo inválido."><input appInput /></app-form-field>',
      { imports },
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Correo inválido.');
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('dos campos tienen ids distintos', async () => {
    await render(
      `<app-form-field label="Uno"><input appInput /></app-form-field>
       <app-form-field label="Dos"><input appInput /></app-form-field>`,
      { imports },
    );
    expect(screen.getByLabelText('Uno').id).not.toBe(screen.getByLabelText('Dos').id);
  });

  it('también sirve para un <select>: etiqueta asociada y error accesible', async () => {
    await render(
      '<app-form-field label="Rol" error="Elige un rol"><select appInput><option value="1">Admin</option></select></app-form-field>',
      { imports },
    );
    const select = screen.getByLabelText('Rol');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Elige un rol');
  });

  it('un input sin FormField sigue funcionando', async () => {
    await render('<input appInput aria-label="Suelto" />', { imports });
    expect(screen.getByLabelText('Suelto')).toBeInTheDocument();
  });

  it('proyecta los slots de prefijo y sufijo', async () => {
    await render(
      `<app-form-field label="Clave">
         <span data-slot="prefix">P</span>
         <input appInput />
         <span data-slot="suffix">S</span>
       </app-form-field>`,
      { imports },
    );
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('el mensaje de error entra con animación', async () => {
    await render('<app-form-field label="Correo" error="Correo inválido."><input appInput /></app-form-field>', { imports });
    expect(screen.getByRole('alert')).toHaveClass('animate-error-in');
  });
});
