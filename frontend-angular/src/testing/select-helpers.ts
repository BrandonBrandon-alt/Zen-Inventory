import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

/** Abre el selector con ese nombre accesible y elige la opción cuyo nombre empieza por `option` (el selector es un componente propio, no un `<select>`). */
export async function chooseOption(label: string, option: string): Promise<void> {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }));
}
