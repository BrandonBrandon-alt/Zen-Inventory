import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormField } from '../form-field/form-field';
import type { SelectOption } from '../select/select';
import { MultiSelect } from './multi-select';

const OPTIONS: SelectOption<number>[] = [
  { value: 1, label: 'Panamá', description: 'Ciudad de Panamá' },
  { value: 2, label: 'Bogotá' },
  { value: 3, label: 'Lima', disabled: true },
  { value: 4, label: 'Quito' },
  { value: 5, label: 'Medellín' },
];

@Component({
  imports: [MultiSelect, FormField, ReactiveFormsModule],
  template: `
    <app-form-field label="Ciudades" [error]="error">
      <app-multi-select [formControl]="control" [options]="options" [maxChips]="maxChips" placeholder="Elige ciudades" />
    </app-form-field>
  `,
})
class Host {
  control = new FormControl<number[]>([], { nonNullable: true, validators: Validators.required });
  options = OPTIONS;
  maxChips = 3;
  error: string | null = null;
}

@Component({
  imports: [MultiSelect],
  template: `<app-multi-select [(values)]="chosen" [options]="options" ariaLabel="Ciudades" />`,
})
class TwoWayHost {
  chosen = signal<readonly number[]>([2]);
  options = OPTIONS;
}

async function setup(props: Partial<Host> = {}) {
  const result = await render(Host, { componentProperties: props });
  const host = result.fixture.componentInstance;
  const field = () => screen.getByRole('combobox', { name: 'Ciudades' });
  const open = async () => userEvent.click(field());
  const labels = () => screen.queryAllByRole('option').map((o) => o.textContent?.replace(/\s+/g, ' ').trim());
  const pick = async (name: RegExp | string) => userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
  return { host, field, open, labels, pick, ...result };
}

describe('MultiSelect', () => {
  describe('estructura', () => {
    it('la etiqueta del campo nombra a la búsqueda y muestra el placeholder', async () => {
      const { field } = await setup();
      expect(field()).toHaveAttribute('placeholder', 'Elige ciudades');
      expect(field()).toHaveAttribute('aria-haspopup', 'listbox');
      expect(field()).toHaveAttribute('aria-expanded', 'false');
    });

    it('cerrado no hay lista; al abrir se listan todas las opciones y la lista es multiselección', async () => {
      const { open, field, labels } = await setup();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await open();
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
      expect(field()).toHaveAttribute('aria-expanded', 'true');
      expect(labels()).toEqual(['PanamáCiudad de Panamá', 'Bogotá', 'Lima', 'Quito', 'Medellín']);
      expect(screen.getByRole('option', { name: /Lima/ })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('elegir varias', () => {
    it('al elegir no se cierra la lista y se pueden marcar varias opciones seguidas', async () => {
      const { host, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await pick('Quito');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(host.control.value).toEqual([2, 4]);
      expect(screen.getByRole('option', { name: /Bogotá/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: /Panamá/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('volver a pulsar una opción marcada la desmarca', async () => {
      const { host, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await pick('Bogotá');
      expect(host.control.value).toEqual([]);
    });

    it('no deja elegir una opción deshabilitada', async () => {
      const { host, open, pick } = await setup();
      await open();
      await pick('Lima');
      expect(host.control.value).toEqual([]);
    });

    it('lo elegido se ve como fichas en el campo, en el orden de elección', async () => {
      const { open, pick } = await setup();
      await open();
      await pick('Quito');
      await pick('Panamá');
      expect(screen.getByRole('button', { name: 'Quitar Quito' })).toBeInTheDocument();
      const chips = screen.getAllByRole('button', { name: /^Quitar / }).map((b) => b.getAttribute('aria-label'));
      expect(chips).toEqual(['Quitar Quito', 'Quitar Panamá']);
    });

    it('resume las fichas que pasan del máximo como «+N más»', async () => {
      const { host, open, pick } = await setup({ maxChips: 2 });
      await open();
      await pick('Panamá');
      await pick('Bogotá');
      await pick('Quito');
      await pick('Medellín');
      expect(host.control.value).toEqual([1, 2, 4, 5]);
      expect(screen.getAllByRole('button', { name: /^Quitar / })).toHaveLength(2);
      expect(screen.getByText('+2 más')).toBeInTheDocument();
    });
  });

  describe('búsqueda integrada', () => {
    it('escribir filtra la lista sin importar mayúsculas ni tildes y abre el panel', async () => {
      const { field, labels } = await setup();
      await userEvent.type(field(), 'medellin');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(labels()).toEqual(['Medellín']);
    });

    it('también busca en la descripción', async () => {
      const { field, labels } = await setup();
      await userEvent.type(field(), 'ciudad de');
      expect(labels()).toEqual(['PanamáCiudad de Panamá']);
    });

    it('sin coincidencias muestra el texto vacío', async () => {
      const { field } = await setup();
      await userEvent.type(field(), 'zzz');
      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    });

    it('al elegir una opción la búsqueda se limpia para seguir con otra', async () => {
      const { field, pick, labels } = await setup();
      await userEvent.type(field(), 'quit');
      await pick('Quito');
      expect(field()).toHaveValue('');
      expect(labels()).toHaveLength(5);
    });

    it('«Seleccionar visibles» marca solo lo que deja el filtro y respeta las deshabilitadas', async () => {
      const { host, field } = await setup();
      await userEvent.type(field(), 'a');
      await userEvent.click(screen.getByRole('button', { name: 'Seleccionar visibles' }));
      // Con «a» quedan Panamá, Bogotá y Lima (deshabilitada): Quito y Medellín no se tocan.
      expect(host.control.value).toEqual([1, 2]);
    });

    it('«Limpiar» quita todo lo elegido', async () => {
      const { host, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await pick('Quito');
      await userEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
      expect(host.control.value).toEqual([]);
    });
  });

  describe('quitar fichas', () => {
    it('el botón de la ficha la quita', async () => {
      const { host, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await pick('Quito');
      await userEvent.click(screen.getByRole('button', { name: 'Quitar Bogotá' }));
      expect(host.control.value).toEqual([4]);
    });

    it('Retroceso con la búsqueda vacía quita la última', async () => {
      const { host, field, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await pick('Quito');
      await userEvent.type(field(), '{Backspace}');
      expect(host.control.value).toEqual([2]);
    });

    it('Retroceso con texto escrito solo borra el texto', async () => {
      const { host, field, open, pick } = await setup();
      await open();
      await pick('Bogotá');
      await userEvent.type(field(), 'ab{Backspace}');
      expect(host.control.value).toEqual([2]);
      expect(field()).toHaveValue('a');
    });
  });

  describe('teclado', () => {
    it('↓ y Enter eligen sin cerrar la lista, saltando las deshabilitadas', async () => {
      const { host, field } = await setup();
      field().focus();
      await userEvent.keyboard('{ArrowDown}'); // abre, activa Panamá
      await userEvent.keyboard('{ArrowDown}{ArrowDown}'); // Bogotá, y Lima se salta → Quito
      await userEvent.keyboard('{Enter}');
      expect(host.control.value).toEqual([4]);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('aria-activedescendant apunta a la opción activa', async () => {
      const { field, open } = await setup();
      await open();
      const active = field().getAttribute('aria-activedescendant');
      expect(active).toBeTruthy();
      expect(document.getElementById(active!)).toHaveTextContent('Panamá');
    });

    it('Escape cierra la lista y no propaga al contenedor', async () => {
      const { field, open } = await setup();
      let escapeReachedWindow = false;
      window.addEventListener('keydown', (e) => (escapeReachedWindow ||= e.key === 'Escape'), { once: true });
      await open();
      await userEvent.type(field(), '{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(escapeReachedWindow).toBe(false);
    });

    it('Escape con la lista cerrada deja pasar el evento', async () => {
      const { field } = await setup();
      let reached = false;
      window.addEventListener('keydown', (e) => (reached ||= e.key === 'Escape'), { once: true });
      field().focus();
      await userEvent.keyboard('{Escape}');
      expect(reached).toBe(true);
    });

    it('Tab cierra la lista', async () => {
      const { open } = await setup();
      await open();
      await userEvent.keyboard('{Tab}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('un clic fuera cierra la lista', async () => {
      const { open } = await setup();
      await open();
      await userEvent.click(document.body);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('formulario', () => {
    it('writeValue refleja los valores del control en las fichas', async () => {
      const { host, fixture } = await setup();
      host.control.setValue([2, 4]);
      fixture.detectChanges();
      expect(screen.getByRole('button', { name: 'Quitar Bogotá' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quitar Quito' })).toBeInTheDocument();
    });

    it('un valor que ya no está en la lista no genera ficha', async () => {
      const { host, fixture } = await setup();
      host.control.setValue([99]);
      fixture.detectChanges();
      expect(screen.queryAllByRole('button', { name: /^Quitar / })).toHaveLength(0);
    });

    it('deshabilitado: no abre ni elige ni muestra fichas editables', async () => {
      const { host, field, fixture } = await setup();
      host.control.setValue([2]);
      host.control.disable();
      fixture.detectChanges();
      expect(field()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Quitar Bogotá' })).toBeDisabled();
      await userEvent.click(field());
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('marca el control como tocado al cerrar', async () => {
      const { host, open } = await setup();
      await open();
      expect(host.control.touched).toBe(false);
      await userEvent.keyboard('{Escape}');
      expect(host.control.touched).toBe(true);
    });

    it('muestra el error del campo asociado a la búsqueda', async () => {
      const { field } = await setup({ error: 'Elige al menos una' });
      expect(field()).toHaveAttribute('aria-invalid', 'true');
      expect(field()).toHaveAccessibleDescription('Elige al menos una');
    });
  });

  describe('enlace bidireccional', () => {
    it('[(values)] recibe los cambios y refleja los de fuera', async () => {
      const { fixture } = await render(TwoWayHost);
      const host = fixture.componentInstance;
      expect(screen.getByRole('button', { name: 'Quitar Bogotá' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('combobox', { name: 'Ciudades' }));
      await userEvent.click(screen.getByRole('option', { name: /^Quito/ }));
      expect(host.chosen()).toEqual([2, 4]);
      host.chosen.set([]);
      fixture.detectChanges();
      expect(screen.queryAllByRole('button', { name: /^Quitar / })).toHaveLength(0);
    });
  });
});
