import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLock, LucideMail } from '@lucide/angular';
import { DASHBOARD_URL } from '@core/auth/auth-urls';
import { AuthApi, AuthError } from '@core/auth/http/auth-api';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Logo } from '@shared/ui/logo/logo';
import { PasswordToggle } from '@shared/ui/password-toggle/password-toggle';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';

/** Título de marca, letra por letra para animarlo. */
const BRAND_TITLE = 'Zen Inventory';
/** Retraso (s) de la primera letra y entre letras consecutivas. */
const LETTER_START_DELAY = 0.2;
const LETTER_STEP = 0.04;

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
    ThemeToggle,
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
  protected readonly titleLetters = Array.from(BRAND_TITLE, (char, index) => ({
    char,
    delay: LETTER_START_DELAY + index * LETTER_STEP,
  }));
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** El formulario "tiembla" cuando el servidor rechaza el intento (credenciales, cuenta desactivada, datos). */
  protected readonly shaking = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected emailError(): string | null {
    return controlError(this.form.controls.email, EMAIL_MESSAGES);
  }

  protected passwordError(): string | null {
    return controlError(this.form.controls.password, PASSWORD_MESSAGES);
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
      this.showError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Solo el fin del temblor del propio formulario (las animaciones de sus hijos también burbujean hasta aquí). */
  protected onShakeEnd(event: AnimationEvent): void {
    if (event.target === event.currentTarget) this.shaking.set(false);
  }

  /** Errores por campo del backend bajo cada campo; el resto (credenciales, red, servidor) en un aviso del formulario. */
  private showError(error: unknown): void {
    if (!(error instanceof AuthError)) {
      this.serverError.set('Error inesperado.');
      return;
    }
    if (error.kind === 'credentials' || error.kind === 'disabled' || error.kind === 'validation') this.shaking.set(true);
    const applied = error.kind === 'validation' ? applyServerErrors(this.form, error.fieldErrors) : [];
    this.serverError.set(applied.length > 0 ? null : error.message);
  }

}
