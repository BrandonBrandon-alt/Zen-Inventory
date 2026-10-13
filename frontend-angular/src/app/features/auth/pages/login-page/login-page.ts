import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLock, LucideMail } from '@lucide/angular';
import { DASHBOARD_URL } from '@core/auth/auth-urls';
import { AuthApi, AuthError } from '@core/auth/http/auth-api';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Logo } from '@shared/ui/logo/logo';
import { PasswordToggle } from '@shared/ui/password-toggle/password-toggle';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

const EMAIL_MESSAGES: Record<string, string> = {
  required: 'El correo es requerido.',
  pattern: 'Correo inválido.',
};
const PASSWORD_MESSAGES: Record<string, string> = {
  required: 'La contraseña es requerida.',
  minlength: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
};

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    Alert,
    Button,
    FormField,
    InputDirective,
    Logo,
    PasswordToggle,
    LucideLock,
    LucideMail,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);

  protected readonly year = new Date().getFullYear();
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected emailError(): string | null {
    return this.messageFor(this.form.controls.email, EMAIL_MESSAGES);
  }

  protected passwordError(): string | null {
    return this.messageFor(this.form.controls.password, PASSWORD_MESSAGES);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const credentials = this.form.getRawValue();
    this.submitting.set(true);
    this.form.disable();
    try {
      await this.auth.login(credentials);
      await this.router.navigateByUrl(DASHBOARD_URL);
    } catch (error) {
      this.form.enable();
      this.serverError.set(error instanceof AuthError ? error.message : 'Error inesperado.');
    } finally {
      this.submitting.set(false);
    }
  }

  /** Muestra el primer error del control, pero solo después de que el usuario lo tocó. */
  private messageFor(control: AbstractControl, messages: Record<string, string>): string | null {
    if (!control.touched || !control.errors) return null;
    const key = Object.keys(control.errors)[0];
    return messages[key] ?? null;
  }
}
