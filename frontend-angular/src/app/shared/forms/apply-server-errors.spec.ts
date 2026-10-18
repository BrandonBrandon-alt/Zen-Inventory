import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { SERVER_ERROR_KEY, applyServerErrors } from './apply-server-errors';

const buildForm = () =>
  new FormGroup({ email: new FormControl(''), password: new FormControl('') });

describe('applyServerErrors', () => {
  it('marca cada campo con el error del servidor y lo da por tocado', () => {
    const form = buildForm();
    const applied = applyServerErrors(form, { email: 'Formato de email inválido' });
    expect(applied).toEqual(['email']);
    expect(form.controls.email.errors).toEqual({ [SERVER_ERROR_KEY]: 'Formato de email inválido' });
    expect(form.controls.email.touched).toBe(true);
    expect(form.controls.password.errors).toBeNull();
  });

  it('ignora los campos que el formulario no tiene (y lo informa para mostrar el mensaje aparte)', () => {
    const form = buildForm();
    const applied = applyServerErrors(form, { nombre: 'obligatorio' });
    expect(applied).toEqual([]);
    expect(form.controls.email.errors).toBeNull();
  });

  it('aplica varios campos a la vez', () => {
    const form = buildForm();
    expect(applyServerErrors(form, { email: 'a', password: 'b' }).sort()).toEqual(['email', 'password']);
  });

  it('el error del servidor se limpia cuando el usuario corrige el valor', () => {
    const form = buildForm();
    applyServerErrors(form, { email: 'Formato de email inválido' });
    form.controls.email.setValue('ana@zen.com');
    expect(form.controls.email.errors).toBeNull();
  });

  it('con un mapa vacío no hace nada', () => {
    const form = buildForm();
    expect(applyServerErrors(form, {})).toEqual([]);
  });
});
