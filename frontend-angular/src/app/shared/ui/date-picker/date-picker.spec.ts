import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormField } from '../form-field/form-field';
import { DatePicker } from './date-picker';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

/** Hoy en las pruebas: jueves 15 de octubre de 2026, 10:00. */
const NOW = d(2026, 10, 15, 10, 0);

const open = async () => userEvent.click(screen.getByRole('button', { expanded: false }));
const day = (name: RegExp | string) => screen.getByRole('button', { name });
const panel = () => screen.getByRole('dialog', { name: 'Calendario' });

async function setup(props: Record<string, unknown> = {}) {
  const control = new FormControl<Date | null>((props['initial'] as Date | null) ?? null);
  const inputs = { ...props };
  delete inputs['initial'];
  const result = await render(
    `<app-form-field label="Fecha">
       <app-date-picker [formControl]="control" [placeholder]="placeholder" [min]="min" [max]="max" [showTime]="showTime" [clearable]="clearable" />
     </app-form-field>`,
    {
      imports: [DatePicker, FormField, ReactiveFormsModule],
      componentProperties: { control, placeholder: 'Elige una fecha', min: null, max: null, showTime: false, clearable: true, ...inputs },
    },
  );
  return { control, ...result };
}

describe('DatePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe('campo', () => {
    it('sin valor muestra el texto de ayuda; la etiqueta del campo apunta al selector', async () => {
      await setup({ placeholder: 'Sin fecha estimada' });
      expect(screen.getByText('Sin fecha estimada')).toBeInTheDocument();
      expect(screen.getByLabelText('Fecha')).toBe(screen.getByRole('button', { expanded: false }));
    });

    it('con valor lo muestra con el formato corto en español (con hora, si corresponde)', async () => {
      await setup({ initial: d(2026, 10, 5, 9, 5) });
      expect(screen.getByText('5 oct 2026')).toBeInTheDocument();
    });

    it('con hora, la muestra junto a la fecha', async () => {
      await setup({ initial: d(2026, 10, 5, 9, 5), showTime: true });
      expect(screen.getByText('5 oct 2026, 09:05')).toBeInTheDocument();
    });

    it('un valor que no es una fecha válida se ignora', async () => {
      const { control, fixture } = await setup();
      control.setValue(new Date('no es fecha'));
      fixture.detectChanges();
      expect(screen.getByText('Elige una fecha')).toBeInTheDocument();
    });

    it('deshabilitado no se abre', async () => {
      const { control, fixture } = await setup();
      control.disable();
      fixture.detectChanges();
      expect(screen.getByLabelText('Fecha')).toBeDisabled();
    });
  });

  describe('calendario', () => {
    it('se abre en el mes de hoy, con los días de la semana desde el lunes y hoy marcado', async () => {
      await setup();
      await open();
      expect(within(panel()).getByText('octubre de 2026')).toBeInTheDocument();
      expect(within(panel()).getAllByRole('columnheader').map((h) => h.getAttribute('aria-label'))).toEqual([
        'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
      ]);
      expect(day('jueves, 15 de octubre de 2026')).toHaveAttribute('aria-current', 'date');
      expect(day('jueves, 1 de octubre de 2026')).not.toHaveAttribute('aria-current');
    });

    it('con un valor, se abre en su mes y lo marca como elegido', async () => {
      await setup({ initial: d(2026, 12, 25) });
      await open();
      expect(within(panel()).getByText('diciembre de 2026')).toBeInTheDocument();
      expect(screen.getByRole('gridcell', { selected: true })).toContainElement(day('viernes, 25 de diciembre de 2026'));
    });

    it('los botones de mes cambian el mes que se ve', async () => {
      await setup();
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
      expect(within(panel()).getByText('noviembre de 2026')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
      await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
      expect(within(panel()).getByText('septiembre de 2026')).toBeInTheDocument();
    });

    it('muestra los días vecinos del mes, atenuados, y se pueden elegir', async () => {
      const { control } = await setup();
      await open();
      await userEvent.click(day('lunes, 28 de septiembre de 2026'));
      expect(control.value).toEqual(d(2026, 9, 28));
    });
  });

  describe('elegir', () => {
    it('elegir un día guarda la fecha a medianoche, cierra el calendario y devuelve el foco al campo', async () => {
      const { control } = await setup();
      await open();
      await userEvent.click(day('viernes, 16 de octubre de 2026'));
      expect(control.value).toEqual(d(2026, 10, 16));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Fecha')).toHaveFocus();
      expect(screen.getByText('16 oct 2026')).toBeInTheDocument();
    });

    it('"Hoy" elige el día de hoy', async () => {
      const { control } = await setup();
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
      expect(control.value).toEqual(d(2026, 10, 15));
    });

    it('"Quitar fecha" la borra; no aparece si no hay fecha o si no es quitable', async () => {
      const { control } = await setup({ initial: d(2026, 10, 20) });
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Quitar fecha' }));
      expect(control.value).toBeNull();
      await open();
      expect(screen.queryByRole('button', { name: 'Quitar fecha' })).not.toBeInTheDocument();
    });

    it('con clearable=false no se ofrece quitar la fecha', async () => {
      await setup({ initial: d(2026, 10, 20), clearable: false });
      await open();
      expect(screen.queryByRole('button', { name: 'Quitar fecha' })).not.toBeInTheDocument();
    });

    it('Escape cierra el calendario sin cerrar lo que lo contiene', async () => {
      const outer = vi.fn();
      await render(`<div (keydown)="outer($event)"><app-date-picker [formControl]="control" /></div>`, {
        imports: [DatePicker, ReactiveFormsModule],
        componentProperties: { control: new FormControl<Date | null>(null), outer },
      });
      await open();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(outer.mock.calls.filter(([event]) => (event as KeyboardEvent).key === 'Escape')).toHaveLength(0);
    });

    it('pulsar fuera lo cierra', async () => {
      await setup();
      await open();
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('marca el campo como tocado al cerrarse', async () => {
      const { control } = await setup();
      expect(control.touched).toBe(false);
      await open();
      await userEvent.keyboard('{Escape}');
      expect(control.touched).toBe(true);
    });
  });

  describe('rango', () => {
    it('los días fuera de min y max están deshabilitados y no se pueden elegir', async () => {
      const { control } = await setup({ min: d(2026, 10, 10), max: d(2026, 10, 20) });
      await open();
      expect(day('jueves, 8 de octubre de 2026')).toBeDisabled();
      expect(day('jueves, 22 de octubre de 2026')).toBeDisabled();
      expect(day('sábado, 10 de octubre de 2026')).toBeEnabled();
      expect(day('martes, 20 de octubre de 2026')).toBeEnabled();
      await userEvent.click(day('jueves, 22 de octubre de 2026'));
      expect(control.value).toBeNull();
    });

    it('"Hoy" se deshabilita si hoy queda fuera del rango', async () => {
      await setup({ min: d(2026, 10, 20) });
      await open();
      expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();
    });

    it('sin valor se abre en el primer día permitido si hoy ya no lo es', async () => {
      await setup({ min: d(2026, 12, 3) });
      await open();
      expect(within(panel()).getByText('diciembre de 2026')).toBeInTheDocument();
    });
  });

  describe('teclado', () => {
    it('la flecha abajo en el campo abre el calendario con el foco en el día del cursor', async () => {
      await setup();
      screen.getByLabelText('Fecha').focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(day('jueves, 15 de octubre de 2026')).toHaveFocus();
    });

    it('solo el día del cursor entra en el orden de Tab', async () => {
      await setup();
      await open();
      const focusable = within(panel())
        .getAllByRole('button')
        .filter((b) => b.getAttribute('tabindex') === '0');
      expect(focusable.map((b) => b.getAttribute('aria-label'))).toEqual(['jueves, 15 de octubre de 2026']);
    });

    it.each([
      ['{ArrowRight}', 'viernes, 16 de octubre de 2026'],
      ['{ArrowLeft}', 'miércoles, 14 de octubre de 2026'],
      ['{ArrowDown}', 'jueves, 22 de octubre de 2026'],
      ['{ArrowUp}', 'jueves, 8 de octubre de 2026'],
      ['{Home}', 'lunes, 12 de octubre de 2026'],
      ['{End}', 'domingo, 18 de octubre de 2026'],
    ])('%s mueve el foco a %s', async (key, expected) => {
      await setup();
      await open();
      await userEvent.keyboard(key);
      expect(day(expected)).toHaveFocus();
    });

    it('RePág/AvPág cambian de mes (con Mayús, de año) y el foco los sigue', async () => {
      await setup();
      await open();
      await userEvent.keyboard('{PageDown}');
      expect(within(panel()).getByText('noviembre de 2026')).toBeInTheDocument();
      expect(day('domingo, 15 de noviembre de 2026')).toHaveFocus();
      await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
      expect(within(panel()).getByText('noviembre de 2025')).toBeInTheDocument();
    });

    it('al pasar de mes con la flecha, el foco cruza al mes siguiente', async () => {
      await setup({ initial: d(2026, 10, 31) });
      await open();
      await userEvent.keyboard('{ArrowRight}');
      expect(within(panel()).getByText('noviembre de 2026')).toBeInTheDocument();
      expect(day('domingo, 1 de noviembre de 2026')).toHaveFocus();
    });

    it('Enter elige el día enfocado', async () => {
      const { control } = await setup();
      await open();
      await userEvent.keyboard('{ArrowRight}{Enter}');
      expect(control.value).toEqual(d(2026, 10, 16));
    });
  });

  describe('con hora', () => {
    const hour = () => screen.getByLabelText('Hora');
    const minutes = () => screen.getByLabelText('Minutos');

    it('elegir un día no cierra el calendario: propone las 09:00 y permite ajustar la hora', async () => {
      const { control } = await setup({ showTime: true });
      await open();
      await userEvent.click(day('viernes, 16 de octubre de 2026'));
      expect(control.value).toEqual(d(2026, 10, 16, 9, 0));
      expect(panel()).toBeInTheDocument();
      await userEvent.selectOptions(hour(), '14');
      await userEvent.selectOptions(minutes(), '45');
      expect(control.value).toEqual(d(2026, 10, 16, 14, 45));
      await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('16 oct 2026, 14:45')).toBeInTheDocument();
    });

    it('la hora es de 24 horas (00 a 23) y los minutos de cinco en cinco', async () => {
      await setup({ showTime: true, initial: d(2026, 10, 16, 9, 0) });
      await open();
      expect(within(hour()).getAllByRole('option')).toHaveLength(24);
      expect(within(hour()).getAllByRole('option').at(-1)).toHaveTextContent('23');
      expect(within(minutes()).getAllByRole('option').map((o) => o.textContent)).toEqual(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
    });

    it('si la hora trae un minuto que no es múltiplo de cinco, también se ofrece (no se pierde)', async () => {
      await setup({ showTime: true, initial: d(2026, 10, 16, 9, 7) });
      await open();
      expect(minutes()).toHaveValue('07');
    });

    it('cambiar de día conserva la hora ya elegida', async () => {
      const { control } = await setup({ showTime: true, initial: d(2026, 10, 16, 14, 45) });
      await open();
      await userEvent.click(day('sábado, 17 de octubre de 2026'));
      expect(control.value).toEqual(d(2026, 10, 17, 14, 45));
    });

    it('la hora está deshabilitada hasta elegir un día', async () => {
      await setup({ showTime: true });
      await open();
      expect(hour()).toBeDisabled();
      expect(minutes()).toBeDisabled();
      expect(screen.getByText('Elige un día')).toBeInTheDocument();
    });

    it('con un mínimo con hora, elegir ese día no deja una hora anterior al mínimo', async () => {
      const { control } = await setup({ showTime: true, min: d(2026, 10, 15, 14, 30) });
      await open();
      await userEvent.click(day('jueves, 15 de octubre de 2026'));
      expect(control.value).toEqual(d(2026, 10, 15, 14, 30)); // las 09:00 propuestas quedaron antes del mínimo
      await userEvent.selectOptions(hour(), '08');
      expect(control.value).toEqual(d(2026, 10, 15, 14, 30));
      await userEvent.selectOptions(hour(), '16');
      expect(control.value).toEqual(d(2026, 10, 15, 16, 30));
    });

    it('sin hora no hay selector de hora ni botón "Listo"', async () => {
      await setup();
      await open();
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument();
    });
  });

  describe('semanas', () => {
    it('un mes que cabe en cinco semanas dibuja cinco filas (más bajo, cabe mejor)', async () => {
      await setup(); // octubre de 2026
      await open();
      // Una fila de encabezado + cinco de días.
      expect(within(panel()).getAllByRole('row')).toHaveLength(6);
    });

    it('un mes que necesita seis semanas dibuja seis filas', async () => {
      await setup({ initial: d(2026, 8, 10) }); // agosto de 2026 empieza en sábado
      await open();
      expect(within(panel()).getAllByRole('row')).toHaveLength(7);
    });
  });

  it('sirve también con [(value)] fuera de un formulario', async () => {
    const result = await render(`<app-date-picker [(value)]="when" />`, {
      imports: [DatePicker],
      componentProperties: { when: null as Date | null },
    });
    await open();
    await userEvent.click(day('viernes, 16 de octubre de 2026'));
    expect((result.fixture.componentInstance as { when: Date | null }).when).toEqual(d(2026, 10, 16));
  });
});
