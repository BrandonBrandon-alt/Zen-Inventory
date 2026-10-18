import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { SERVER_ERROR_KEY } from './apply-server-errors';
import { controlError } from './control-error';

const MESSAGES = { required: 'Es requerido.', minlength: 'Muy corto.' };

describe('controlError', () => {
  it('no muestra nada hasta que el usuario toca el campo', () => {
    const control = new FormControl('', Validators.required);
    expect(controlError(control, MESSAGES)).toBeNull();
  });

  it('tras tocarlo muestra el mensaje del primer validador fallido', () => {
    const control = new FormControl('', [Validators.required, Validators.minLength(3)]);
    control.markAsTouched();
    expect(controlError(control, MESSAGES)).toBe('Es requerido.');
    control.setValue('ab');
    expect(controlError(control, MESSAGES)).toBe('Muy corto.');
  });

  it('un campo válido no muestra nada', () => {
    const control = new FormControl('abcd', [Validators.required, Validators.minLength(3)]);
    control.markAsTouched();
    expect(controlError(control, MESSAGES)).toBeNull();
  });

  it('un error del servidor se muestra tal cual, por encima de los mensajes de validadores', () => {
    const control = new FormControl('x', Validators.required);
    control.setErrors({ [SERVER_ERROR_KEY]: 'El servidor no acepta este valor' });
    control.markAsTouched();
    expect(controlError(control, MESSAGES)).toBe('El servidor no acepta este valor');
  });

  it('un validador sin mensaje definido no muestra nada (en vez de inventar uno)', () => {
    const control = new FormControl('', Validators.required);
    control.markAsTouched();
    expect(controlError(control, {})).toBeNull();
  });
});
