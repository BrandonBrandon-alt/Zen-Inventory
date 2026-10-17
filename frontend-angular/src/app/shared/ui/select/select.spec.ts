import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideShield, LucideStore } from '@lucide/angular';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from '../form-field/form-field';
import { Select, type SelectOption } from './select';

const OPTIONS: SelectOption<number>[] = [
  { value: 1, label: 'Panamá', description: 'Ciudad de Panamá', icon: LucideStore.icon },
  { value: 2, label: 'Bogotá' },
  { value: 3, label: 'Lima', disabled: true },
  { value: 4, label: 'Quito' },
];

@Component({
  imports: [Select, FormField, ReactiveFormsModule],
  template: `
    <app-form-field label="Ciudad" [error]="error">
      <app-select [formControl]="control" [options]="options" [searchable]="searchable" [icon]="icon" placeholder="Elige una ciudad" />
    </app-form-field>
  `,
})
class Host {
  control = new FormControl<number | null>(null, Validators.required);
  options = OPTIONS;
  searchable = true;
  icon = LucideShield.icon;
  error: string | null = null;
}

async function setup(props: Partial<Host> = {}) {
  const result = await render(Host, { componentProperties: props });
  const host = result.fixture.componentInstance;
  const trigger = () => screen.getByRole('combobox', { name: 'Ciudad' });
  const open = async () => userEvent.click(trigger());
  const options = () => screen.queryAllByRole('option').map((o) => within(o).getAllByText(/./)[0].textContent);
  return { host, trigger, open, options, ...result };
}

describe('Select', () => {
  describe('estructura', () => {
    it('la etiqueta del campo nombra al selector y muestra el placeholder', async () => {
      const { trigger } = await setup();
      expect(trigger()).toHaveTextContent('Elige una ciudad');
      expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('cerrado no muestra opciones; al abrir las lista con su rol', async () => {
      const { open, trigger, options } = await setup();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await open();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(options()).toEqual(['Panamá', 'Bogotá', 'Lima', 'Quito']);
    });

    it('muestra la descripción de la opción y marca la deshabilitada', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByText('Ciudad de Panamá')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Lima/ })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('selección', () => {
    it('elegir una opción actualiza el formulario, cierra el panel y muestra el texto', async () => {
      const { open, trigger, host } = await setup();
      await open();
      await userEvent.click(screen.getByRole('option', { name: /Bogotá/ }));
      expect(host.control.value).toBe(2);
      expect(trigger()).toHaveTextContent('Bogotá');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(host.control.touched).toBe(true);
    });

    it('la opción elegida queda marcada como seleccionada al reabrir', async () => {
      const { open } = await setup();
      await open();
      await userEvent.click(screen.getByRole('option', { name: /Quito/ }));
      await open();
      expect(screen.getByRole('option', { name: /Quito/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: /Bogotá/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('una opción deshabilitada no se puede elegir', async () => {
      const { open, host } = await setup();
      await open();
      await userEvent.click(screen.getByRole('option', { name: /Lima/ }));
      expect(host.control.value).toBeNull();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('refleja un valor puesto desde el formulario (setValue)', async () => {
      const { host, trigger, fixture } = await setup();
      host.control.setValue(4);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(trigger()).toHaveTextContent('Quito');
    });

    it('con un valor que no existe en las opciones muestra el placeholder', async () => {
      const { host, trigger, fixture } = await setup();
      host.control.setValue(99);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(trigger()).toHaveTextContent('Elige una ciudad');
    });
  });

  describe('búsqueda', () => {
    it('filtra mientras se escribe, sin distinguir mayúsculas ni acentos', async () => {
      const { open, options } = await setup();
      await open();
      await userEvent.type(screen.getByRole('textbox', { name: 'Buscar…' }), 'PANAMA');
      expect(options()).toEqual(['Panamá']);
    });

    it('los acentos a mitad de palabra no estorban, ni al escribir ni en la opción', async () => {
      const { open, options } = await setup({ options: [{ value: 9, label: 'Medellín' }, { value: 8, label: 'Cali' }] });
      await open();
      const search = screen.getByRole('textbox', { name: 'Buscar…' });
      await userEvent.type(search, 'medellin');
      expect(options()).toEqual(['Medellín']);
      await userEvent.clear(search);
      await userEvent.type(search, 'medéllin');
      expect(options()).toEqual(['Medellín']);
    });

    it('busca también en la descripción', async () => {
      const { open, options } = await setup();
      await open();
      await userEvent.type(screen.getByRole('textbox', { name: 'Buscar…' }), 'ciudad de');
      expect(options()).toEqual(['Panamá']);
    });

    it('sin coincidencias muestra el mensaje y Enter no elige nada', async () => {
      const { open, host } = await setup();
      await open();
      await userEvent.type(screen.getByRole('textbox', { name: 'Buscar…' }), 'zzz{Enter}');
      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
      expect(host.control.value).toBeNull();
    });

    it('al reabrir la búsqueda está vacía', async () => {
      const { open } = await setup();
      await open();
      await userEvent.type(screen.getByRole('textbox', { name: 'Buscar…' }), 'lim');
      await userEvent.keyboard('{Escape}');
      await open();
      expect(screen.getByRole('textbox', { name: 'Buscar…' })).toHaveValue('');
    });

    it('sin searchable no hay cuadro de búsqueda', async () => {
      const { open } = await setup({ searchable: false });
      await open();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('el foco pasa al cuadro de búsqueda al abrir', async () => {
      const { open } = await setup();
      await open();
      await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Buscar…' })).toHaveFocus());
    });
  });

  describe('teclado', () => {
    it('↓ abre el panel; ↓/↑ mueven la opción activa saltando las deshabilitadas; Enter elige', async () => {
      const { trigger, host } = await setup({ searchable: false });
      trigger().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await userEvent.keyboard('{ArrowDown}{ArrowDown}'); // Bogotá -> (Lima deshabilitada) -> Quito
      await userEvent.keyboard('{Enter}');
      expect(host.control.value).toBe(4);
    });

    it('↑ desde la primera da la vuelta a la última habilitada', async () => {
      const { trigger, host } = await setup({ searchable: false });
      trigger().focus();
      await userEvent.keyboard('{Enter}'); // abre con la primera activa
      await userEvent.keyboard('{ArrowUp}{Enter}');
      expect(host.control.value).toBe(4);
    });

    it('Inicio y Fin saltan a los extremos', async () => {
      const { trigger, host } = await setup({ searchable: false });
      trigger().focus();
      await userEvent.keyboard('{Enter}{End}{Enter}');
      expect(host.control.value).toBe(4);
      await userEvent.keyboard('{Enter}{Home}{Enter}');
      expect(host.control.value).toBe(1);
    });

    it('en la búsqueda, ↓ y Enter eligen el primer resultado', async () => {
      const { open, host } = await setup();
      await open();
      await userEvent.type(screen.getByRole('textbox', { name: 'Buscar…' }), 'bo{Enter}');
      expect(host.control.value).toBe(2);
    });

    it('escribir una letra (sin búsqueda) salta a la opción que empieza por ella', async () => {
      const { trigger, host } = await setup({ searchable: false });
      trigger().focus();
      await userEvent.keyboard('q{Enter}');
      expect(host.control.value).toBe(4);
    });

    it('Escape cierra el panel, devuelve el foco y NO se propaga (no cierra un modal que lo contenga)', async () => {
      const { open, trigger } = await setup();
      const outer = vi.fn();
      document.addEventListener('keydown', outer);
      await open();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expect(outer).not.toHaveBeenCalled();
      document.removeEventListener('keydown', outer);
    });

    it('Escape con el panel cerrado sí sigue su camino (para que cierre el modal)', async () => {
      const { trigger } = await setup();
      const outer = vi.fn();
      document.addEventListener('keydown', outer);
      trigger().focus();
      await userEvent.keyboard('{Escape}');
      expect(outer).toHaveBeenCalled();
      document.removeEventListener('keydown', outer);
    });

    it('Tab cierra el panel', async () => {
      const { open } = await setup();
      await open();
      await userEvent.tab();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('cierre y estados', () => {
    it('clic fuera cierra el panel', async () => {
      const { open } = await setup();
      await open();
      await userEvent.click(document.body);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('deshabilitado desde el formulario no abre', async () => {
      const { host, open, trigger, fixture } = await setup();
      host.control.disable();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(trigger()).toBeDisabled();
      await open();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('con un error del campo se marca inválido y descrito por el mensaje', async () => {
      await setup({ error: 'Elige una ciudad' });
      const trigger = screen.getByRole('combobox', { name: 'Ciudad' });
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(trigger).toHaveAccessibleDescription('Elige una ciudad');
    });

    it('la opción activa se anuncia con aria-activedescendant en el cuadro de búsqueda', async () => {
      const { open } = await setup();
      await open();
      const search = screen.getByRole('textbox', { name: 'Buscar…' });
      const active = search.getAttribute('aria-activedescendant');
      expect(active).toBeTruthy();
      expect(document.getElementById(active ?? '')).toHaveTextContent('Panamá');
    });
  });

  describe('iconos', () => {
    it('muestra el icono de la opción elegida en el selector; sin elegir, el icono general', async () => {
      const { trigger, open } = await setup();
      expect(trigger().querySelectorAll('svg')).toHaveLength(2); // icono general + flecha
      await open();
      await userEvent.click(screen.getByRole('option', { name: /Panamá/ }));
      expect(trigger().querySelectorAll('svg')).toHaveLength(2); // icono de la opción + flecha
      await open();
      await userEvent.click(screen.getByRole('option', { name: /Bogotá/ })); // sin icono propio: vuelve al general
      expect(trigger().querySelectorAll('svg')).toHaveLength(2);
    });

    it('las opciones con icono lo dibujan y las demás no', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByRole('option', { name: /Panamá/ }).querySelector('svg')).not.toBeNull();
      expect(screen.getByRole('option', { name: /Bogotá/ }).querySelector('svg')).toBeNull();
    });
  });
});
