# Angular — Etapa 1: Login y Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar en `frontend-angular/` la pantalla de login, el shell de la aplicación (sidebar con menú por rol, tarjeta de usuario, tema claro/oscuro, cierre de sesión) y la protección de rutas por sesión y por rol, con todas las rutas del menú resueltas por una página "en migración".

**Architecture:** Componentes standalone con signals y `OnPush`. Los componentes compartidos (`Button`, `FormField`, `Alert`, `Spinner`, `Logo`) viven en `shared/ui`; la sesión y las guardas en `core/auth`; el shell en `layout/`. El menú y las rutas se generan desde **una sola configuración** (`NAV_SECTIONS`) con los roles permitidos por ítem. El login usa Reactive Forms tipados.

**Tech Stack:** Angular 22 (zoneless), Tailwind 4 con tokens, `@lucide/angular`, Reactive Forms, `@testing-library/angular` + `user-event` + `jest-dom`, Vitest, MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-migracion-nextjs-a-angular-design.md` (§4 arquitectura, §5 componentes, §6 testing). Etapa anterior: `docs/superpowers/plans/2026-10-12-angular-etapa-0-base.md`.

## Global Constraints

- Proyecto en `frontend-angular/`; `frontend/` (Next) NO se toca. Los comandos se ejecutan desde `frontend-angular/` salvo que se indique.
- Standalone, signals, `inject()`, control flow `@if`/`@for`, `ChangeDetectionStrategy.OnPush` en todo componente. Sin NgModules, sin SSR.
- `features` no importa de otra feature; `shared` y `core` no importan de `features` (ESLint lo hace cumplir). Dentro de la misma capa se usan imports relativos; entre capas, los alias `@core/*`, `@shared/*`, `@features/*`.
- Sin `any`, sin `@ts-ignore`, sin hex ni `rgba()` sueltos: solo tokens de `src/styles/theme.css` (utilidades `bg-base`, `text-fg`, `border-line`, `bg-primary`, `text-danger`…).
- Cada componente se prueba con `@testing-library/angular` consultando por rol/texto accesible, no por clases internas ni detalles de implementación. Un test que no puede fallar por un bug real no se escribe.
- Ejecutar los tests siempre con `npm test -- --watch=false` (el script `pretest` limpia una caché de Vitest que da falsos verdes; no usar `ng test` directo).
- Roles del backend (`Role.java`/`PreAuthorize`): `ADMIN`, `MANAGER`, `SELLER`, `OPERADOR_INVENTARIO`. Visibilidad del menú = **paridad con el Sidebar actual del Next** (ver Task 7); las diferencias que se detecten se registran, no se corrigen en silencio.
- Sin cuentas demo ni credenciales en el código del login (decisión del usuario).
- Textos de la interfaz en español, copiados del Next cuando existen.
- El E2E de esta etapa no necesita backend: intercepta `/api/**` con `page.route`.

## Review Focus

- Una sesión con un rol que el frontend no conoce NO provoca un bucle de redirecciones: se limpia y se vuelve a `/login`.
- Si `GET /api/branches/{id}` falla, tarda o devuelve un nombre vacío, el sidebar sigue funcionando y muestra "Zen Inventory".
- Doble clic o Enter repetido en "Ingresar" envía UNA sola petición de login.
- `localStorage` inaccesible: el tema y el estado colapsado del sidebar siguen funcionando en memoria sin lanzar.
- Con el sidebar colapsado, cada enlace conserva su nombre accesible (solo se oculta el texto visible).

## File Structure

```
frontend-angular/
  e2e/login.e2e.ts                                   E2E con /api interceptado
  src/styles/theme.css                               (modifica) token --color-primary-hover
  src/testing/setup.ts                               (modifica) matchers de jest-dom
  src/testing/integration/
    branch-label-api.integration.spec.ts
    routes.integration.spec.ts                       guardas + shell + login con las rutas reales
  src/app/app.config.ts                              (modifica) ThemeService al arrancar
  src/app/app.routes.ts                              (modifica) login, shell y rutas del menú
  src/app/core/auth/
    auth-urls.ts                                     (modifica) DASHBOARD_URL
    role.ts  role.spec.ts                            Role, ROLES, isRole
    auth-store.ts                                    (modifica) role: Signal<Role | null>
    role.guard.ts  role.guard.spec.ts
    guest.guard.ts  guest.guard.spec.ts
  src/app/core/theme/theme.service.ts  theme.service.spec.ts
  src/app/shared/ui/
    spinner.ts  spinner.spec.ts
    logo.ts  logo.spec.ts
    button.ts  button.spec.ts
    form-field.ts  form-field.spec.ts                InputDirective + FormField
    password-toggle.ts  password-toggle.spec.ts
    alert.ts  alert.spec.ts
  src/app/layout/
    nav-items.ts  nav-items.spec.ts
    sidebar-state.ts  sidebar-state.spec.ts
    data-access/branch-label-api.ts
    user-card.ts  user-card.spec.ts
    sidebar.ts  sidebar.html  sidebar.spec.ts
    shell.ts
  src/app/features/auth/pages/login-page.ts  login-page.html  login-page.spec.ts
  src/app/features/not-migrated/pages/not-migrated-page.ts
```

---

### Task 1: Infraestructura de componentes, `Spinner` y `Logo`

**Files:**
- Modify: `src/testing/setup.ts`, `tsconfig.spec.json`
- Create: `src/app/shared/ui/spinner.ts`, `src/app/shared/ui/logo.ts`
- Test: `src/app/shared/ui/spinner.spec.ts`, `src/app/shared/ui/logo.spec.ts`

**Interfaces:**
- Produces: `Spinner` (`<app-spinner [size]="22" />`, input `size: number`, svg `role="status"` con nombre "Cargando", color por `currentColor`); `Logo` (`<app-logo [size]="48" [showText]="false" />`, inputs `size: number`, `showText: boolean`; sin texto es `role="img"` "Zen Inventory"; con texto el svg va `aria-hidden`).

- [ ] **Step 1: Instalar iconos y activar los matchers de jest-dom**

```bash
npm i @lucide/angular
```
Expected: instala sin `ERESOLVE` (el paquete acepta `@angular/core >=17`).

En `src/testing/setup.ts` agregar como **primera** línea:

```ts
import '@testing-library/jest-dom/vitest';
```

En `tsconfig.spec.json`, dentro de `compilerOptions.types`, dejar:

```json
"types": ["vitest/globals", "@testing-library/jest-dom/vitest"]
```

- [ ] **Step 2: Escribir los tests (rojo)**

`src/app/shared/ui/spinner.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('se anuncia como estado de carga accesible', async () => {
    await render(Spinner);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('respeta el tamaño pedido', async () => {
    await render(Spinner, { inputs: { size: 40 } });
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('width', '40');
    expect(spinner).toHaveAttribute('height', '40');
  });
});
```

`src/app/shared/ui/logo.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('sin texto es una imagen accesible con el nombre del producto', async () => {
    await render(Logo);
    expect(screen.getByRole('img', { name: 'Zen Inventory' })).toBeInTheDocument();
    expect(screen.queryByText('Zen Inventory')).not.toBeInTheDocument();
  });

  it('con showText muestra el nombre y oculta el dibujo a los lectores de pantalla', async () => {
    await render(Logo, { inputs: { showText: true } });
    expect(screen.getByText('Zen Inventory')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('respeta el tamaño pedido', async () => {
    await render(Logo, { inputs: { size: 120 } });
    expect(screen.getByRole('img')).toHaveAttribute('width', '120');
  });
});
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `npm test -- --watch=false`
Expected: FAIL por `Could not resolve "./spinner"` y `"./logo"` (no por errores de tipos de `toBeInTheDocument`; si aparece `TS2339: Property 'toBeInTheDocument' does not exist`, revisar el Step 1).

- [ ] **Step 4: Implementar `spinner.ts`**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicador de carga. Toma el color del texto del contenedor (`currentColor`). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg
      role="status"
      aria-label="Cargando"
      class="animate-spin shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      [attr.width]="size()"
      [attr.height]="size()"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" stroke-linecap="round" />
    </svg>
  `,
})
export class Spinner {
  readonly size = input(22);
}
```

- [ ] **Step 5: Implementar `logo.ts`**

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Petal {
  readonly d: string;
  readonly width: number;
  readonly opacity: number;
}

/** Flor de loto: pétalos de atrás hacia adelante. */
const PETALS: readonly Petal[] = [
  { d: 'M60 75 Q20 60 15 30 Q35 45 60 75Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 75 Q100 60 105 30 Q85 45 60 75Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 75 Q10 55 8 20 Q32 38 60 75Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 75 Q110 55 112 20 Q88 38 60 75Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 80 Q42 95 38 115 Q55 100 60 80Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 80 Q78 95 82 115 Q65 100 60 80Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 80 Q60 100 60 118 Q60 100 60 80Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 70 Q28 58 22 28 Q44 46 60 70Z', width: 1.8, opacity: 0.85 },
  { d: 'M60 70 Q92 58 98 28 Q76 46 60 70Z', width: 1.8, opacity: 0.85 },
  { d: 'M60 72 Q40 60 42 35 Q53 52 60 72Z', width: 1.5, opacity: 0.9 },
  { d: 'M60 72 Q80 60 78 35 Q67 52 60 72Z', width: 1.5, opacity: 0.9 },
  { d: 'M60 72 Q50 40 60 8 Q70 40 60 72Z', width: 2, opacity: 1 },
  { d: 'M60 72 Q42 42 48 12 Q58 42 60 72Z', width: 1.8, opacity: 1 },
  { d: 'M60 72 Q78 42 72 12 Q62 42 60 72Z', width: 1.8, opacity: 1 },
];

/** Nervaduras que parten del centro de la flor. */
const VEINS: readonly { readonly x2: number; readonly y2: number }[] = [
  { x2: 60, y2: 30 },
  { x2: 38, y2: 42 },
  { x2: 82, y2: 42 },
];

/** Logo de Zen Inventory. Toma el color de marca (`text-brand`) salvo que el contenedor indique otro. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2 text-brand' },
  template: `
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="showText() ? null : 'img'"
      [attr.aria-label]="showText() ? null : 'Zen Inventory'"
      [attr.aria-hidden]="showText() ? 'true' : null"
    >
      @for (petal of petals; track petal.d) {
        <path [attr.d]="petal.d" [attr.stroke-width]="petal.width" [attr.opacity]="petal.opacity" />
      }
      @for (vein of veins; track vein.x2) {
        <line x1="60" y1="72" [attr.x2]="vein.x2" [attr.y2]="vein.y2" stroke-width="0.8" opacity="0.3" />
      }
    </svg>
    @if (showText()) {
      <span class="text-sm font-bold tracking-[0.15em] uppercase">Zen Inventory</span>
    }
  `,
})
export class Logo {
  readonly size = input(48);
  readonly showText = input(false);

  protected readonly petals = PETALS;
  protected readonly veins = VEINS;
}
```

- [ ] **Step 6: Ejecutar y comprobar que pasan**

Run: `npm test -- --watch=false && npm run lint`
Expected: PASS (suite completa) y lint limpio.

- [ ] **Step 7: Commit**

```bash
git add frontend-angular && git commit -m "feat(angular): infraestructura de testing de componentes, Spinner y Logo"
```

---

### Task 2: `Button`

**Files:**
- Modify: `src/styles/theme.css` (token `--color-primary-hover`)
- Create: `src/app/shared/ui/button.ts`
- Test: `src/app/shared/ui/button.spec.ts`

**Interfaces:**
- Consumes: `Spinner` (Task 1).
- Produces: `Button`, selector `button[appButton]`; inputs `variant: 'primary' | 'ghost' | 'danger'` (por defecto `'primary'`), `size: 'sm' | 'md' | 'lg'` (`'md'`), `loading: boolean`, `fullWidth: boolean`, `disabled: boolean` (todos con `booleanAttribute`). Con `loading` o `disabled` el botón queda deshabilitado; con `loading` muestra el `Spinner` y `aria-busy="true"`.

- [ ] **Step 1: Token del hover del botón primario**

En `src/styles/theme.css`, dentro de `@theme inline { … }`, tras `--color-primary-fg: var(--btn-primary-text);` agregar:

```css
  --color-primary-hover: var(--btn-primary-hover-bg);
```

- [ ] **Step 2: Escribir el test (rojo)**

`src/app/shared/ui/button.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('muestra su contenido y está habilitado por defecto', async () => {
    await render('<button appButton>Guardar</button>', { imports: [Button] });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('dispara el clic cuando está habilitado', async () => {
    const onClick = vi.fn();
    await render('<button appButton (click)="onClick()">Guardar</button>', {
      imports: [Button],
      componentProperties: { onClick },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('con loading queda deshabilitado, ocupado, muestra el spinner y no dispara el clic', async () => {
    const onClick = vi.fn();
    await render('<button appButton [loading]="true" (click)="onClick()">Guardar</button>', {
      imports: [Button],
      componentProperties: { onClick },
    });
    const button = screen.getByRole('button', { name: /Guardar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sin loading no muestra spinner ni aria-busy', async () => {
    await render('<button appButton>Guardar</button>', { imports: [Button] });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it('con disabled queda deshabilitado', async () => {
    await render('<button appButton [disabled]="true">Guardar</button>', { imports: [Button] });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it.each([
    ['primary', 'bg-primary'],
    ['ghost', 'bg-transparent'],
    ['danger', 'text-danger'],
  ])('la variante %s aplica su estilo', async (variant, expectedClass) => {
    await render(`<button appButton variant="${variant}">X</button>`, { imports: [Button] });
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('fullWidth ocupa todo el ancho', async () => {
    await render('<button appButton fullWidth>X</button>', { imports: [Button] });
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npm test -- --watch=false`
Expected: FAIL con `Could not resolve "./button"`.

- [ ] **Step 4: Implementar `button.ts`**

```ts
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 font-semibold tracking-tight ' +
  'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 enabled:hover:-translate-y-px';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg border border-transparent enabled:hover:bg-primary-hover enabled:hover:shadow-lg',
  ghost: 'bg-transparent text-fg-muted border border-transparent enabled:hover:bg-hover',
  danger: 'bg-danger/10 text-danger border border-danger/30 enabled:hover:bg-danger/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-[7px] text-[13px] rounded-sm',
  md: 'px-[18px] py-2.5 text-sm rounded-md',
  lg: 'px-[22px] py-3 text-[14.5px] rounded-md',
};

/** Botón nativo con estilos del sistema de diseño. Uso: `<button appButton variant="danger">`. */
@Component({
  selector: 'button[appButton]',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[disabled]': 'isDisabled()',
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (loading()) {
      <app-spinner [size]="14" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(() =>
    [BASE, VARIANTS[this.variant()], SIZES[this.size()], this.fullWidth() ? 'w-full' : ''].join(' '),
  );
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npm test -- --watch=false && npm run lint && npm run build`
Expected: PASS, lint limpio y build OK (el build confirma que Tailwind genera `bg-primary`, `bg-danger/10`, `enabled:` etc.).

- [ ] **Step 6: Mutación de comprobación**

Cambiar temporalmente `this.disabled() || this.loading()` por `this.disabled()` y ejecutar `npm test -- --watch=false`: debe fallar el test "con loading queda deshabilitado…". Restaurar y volver a verde.

- [ ] **Step 7: Commit**

```bash
git add frontend-angular && git commit -m "feat(angular): componente Button con variantes, tamaños y estado de carga"
```

---

### Task 3: `FormField`, `InputDirective` y `PasswordToggle`

**Files:**
- Create: `src/app/shared/ui/form-field.ts`, `src/app/shared/ui/password-toggle.ts`
- Test: `src/app/shared/ui/form-field.spec.ts`, `src/app/shared/ui/password-toggle.spec.ts`

**Interfaces:**
- Produces:
  - `InputDirective`, selector `input[appInput]`: genera un `id` único, aplica estilos, y si está dentro de un `FormField` con error pone `aria-invalid="true"` y `aria-describedby` hacia el mensaje.
  - `FormField`, selector `app-form-field`: inputs `label: string | undefined`, `error: string | null`. Enlaza la etiqueta con el input hijo. Slots por atributo: `data-slot="prefix"` (icono a la izquierda) y `data-slot="suffix"` (control a la derecha). El mensaje de error es `role="alert"`.
  - `PasswordToggle`, selector `app-password-toggle`: `model` `visible: boolean`; botón con nombre accesible "Mostrar contraseña" / "Ocultar contraseña" y `aria-pressed`.
- Uso:
  ```html
  <app-form-field label="Correo" [error]="emailError()">
    <svg data-slot="prefix" lucideMail [size]="15" />
    <input appInput formControlName="email" type="email" />
  </app-form-field>
  ```

- [ ] **Step 1: Escribir los tests (rojo)**

`src/app/shared/ui/form-field.spec.ts`:

```ts
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
});
```

`src/app/shared/ui/password-toggle.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `npm test -- --watch=false`
Expected: FAIL con `Could not resolve "./form-field"` y `"./password-toggle"`.

- [ ] **Step 3: Implementar `form-field.ts`**

```ts
import { ChangeDetectionStrategy, Component, Directive, contentChild, inject, input } from '@angular/core';

let nextId = 0;

/** Estilos de un `<input>` del sistema de diseño. Dentro de `app-form-field` hereda errores y etiqueta. */
@Directive({
  selector: 'input[appInput]',
  host: {
    class:
      'w-full rounded-md border border-line bg-card px-3.5 py-[11px] text-sm text-fg outline-none ' +
      'transition-[border-color,box-shadow] duration-200 placeholder:text-fg-subtle ' +
      'focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:opacity-60 ' +
      'aria-[invalid=true]:border-danger/50 aria-[invalid=true]:focus:border-danger ' +
      'aria-[invalid=true]:focus:ring-danger/15 ' +
      'group-has-[[data-slot=prefix]]:pl-10 group-has-[[data-slot=suffix]]:pr-12',
    '[id]': 'id',
    '[attr.aria-invalid]': 'field?.error() ? true : null',
    '[attr.aria-describedby]': 'field?.error() ? field?.errorId : null',
  },
})
export class InputDirective {
  readonly id = `app-input-${nextId++}`;
  protected readonly field = inject(FormField, { optional: true });
}

/** Etiqueta + control + mensaje de error. Los iconos se proyectan con `data-slot="prefix|suffix"`. */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'group flex flex-col gap-1.5' },
  template: `
    @if (label(); as text) {
      <label
        class="text-[13px] font-medium"
        [class]="error() ? 'text-danger' : 'text-fg-muted'"
        [attr.for]="control()?.id"
        >{{ text }}</label
      >
    }
    <div class="relative">
      <span
        class="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2"
        [class]="error() ? 'text-danger' : 'text-fg-subtle'"
      >
        <ng-content select="[data-slot=prefix]" />
      </span>
      <ng-content />
      <span class="absolute top-1/2 right-3 flex -translate-y-1/2">
        <ng-content select="[data-slot=suffix]" />
      </span>
    </div>
    @if (error(); as message) {
      <p [id]="errorId" role="alert" class="flex items-center gap-1 text-xs text-danger">{{ message }}</p>
    }
  `,
})
export class FormField {
  readonly label = input<string>();
  readonly error = input<string | null>(null);

  readonly errorId = `app-field-error-${nextId++}`;
  protected readonly control = contentChild(InputDirective);
}
```

- [ ] **Step 4: Implementar `password-toggle.ts`**

```ts
import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

/** Botón para mostrar u ocultar una contraseña. Se coloca en el slot `suffix` de un `FormField`. */
@Component({
  selector: 'app-password-toggle',
  imports: [LucideEye, LucideEyeOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' },
  template: `
    <button
      type="button"
      class="flex cursor-pointer rounded-sm text-fg-subtle transition-colors hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      [attr.aria-pressed]="visible()"
      (click)="visible.set(!visible())"
    >
      @if (visible()) {
        <svg lucideEyeOff [size]="16" />
      } @else {
        <svg lucideEye [size]="16" />
      }
    </button>
  `,
})
export class PasswordToggle {
  readonly visible = model(false);
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasan**

Run: `npm test -- --watch=false && npm run lint && npm run build`
Expected: PASS, lint limpio, build OK. Si el build rechaza `FormField` usada antes de su declaración dentro de `InputDirective`, mover `inject(FormField…)` a un getter o reordenar las clases con `forwardRef`, y registrar el ajuste en el ledger.

- [ ] **Step 6: Mutación de comprobación**

Quitar temporalmente `'[attr.aria-describedby]'` del `host` de `InputDirective`: debe fallar "con error muestra el mensaje…". Restaurar.

- [ ] **Step 7: Commit**

```bash
git add frontend-angular && git commit -m "feat(angular): FormField, InputDirective y PasswordToggle accesibles"
```

---

### Task 4: `Alert`

**Files:**
- Create: `src/app/shared/ui/alert.ts`
- Test: `src/app/shared/ui/alert.spec.ts`

**Interfaces:**
- Produces: `Alert`, selector `app-alert`, input `variant: 'danger' | 'warning' | 'success' | 'info'` (por defecto `'danger'`); contenido proyectado; `role="alert"` para `danger`/`warning` y `role="status"` para `success`/`info`.

- [ ] **Step 1: Escribir el test (rojo)**

```ts
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('por defecto es un error anunciado como alerta', async () => {
    await render('<app-alert>Credenciales incorrectas</app-alert>', { imports: [Alert] });
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales incorrectas');
  });

  it.each([
    ['danger', 'alert'],
    ['warning', 'alert'],
    ['success', 'status'],
    ['info', 'status'],
  ])('la variante %s se anuncia con el rol %s', async (variant, role) => {
    await render(`<app-alert variant="${variant}">Mensaje</app-alert>`, { imports: [Alert] });
    expect(screen.getByRole(role)).toHaveTextContent('Mensaje');
  });

  it.each([
    ['danger', 'text-danger'],
    ['warning', 'text-warning'],
    ['success', 'text-success'],
    ['info', 'text-info'],
  ])('la variante %s usa su color de estado', async (variant, colorClass) => {
    await render(`<app-alert variant="${variant}">Mensaje</app-alert>`, { imports: [Alert] });
    expect(screen.getByText('Mensaje').closest('[role]')).toHaveClass(colorClass);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla** — `npm test -- --watch=false` → FAIL `Could not resolve "./alert"`.

- [ ] **Step 3: Implementar `alert.ts`**

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

export type AlertVariant = 'danger' | 'warning' | 'success' | 'info';

const STYLES: Record<AlertVariant, string> = {
  danger: 'bg-danger/10 border-danger/25 text-danger',
  warning: 'bg-warning/10 border-warning/25 text-warning',
  success: 'bg-success/10 border-success/25 text-success',
  info: 'bg-info/10 border-info/25 text-info',
};

/** Mensaje destacado. `danger` y `warning` interrumpen al lector de pantalla; el resto, no. */
@Component({
  selector: 'app-alert',
  imports: [LucideCircleAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-2.5 rounded-md border px-4 py-3 text-[13px]"
      [class]="styles()"
      [attr.role]="role()"
    >
      <svg lucideCircleAlert [size]="15" class="shrink-0" />
      <span><ng-content /></span>
    </div>
  `,
})
export class Alert {
  readonly variant = input<AlertVariant>('danger');

  protected readonly styles = computed(() => STYLES[this.variant()]);
  protected readonly role = computed(() =>
    this.variant() === 'danger' || this.variant() === 'warning' ? 'alert' : 'status',
  );
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa** — `npm test -- --watch=false && npm run lint && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add frontend-angular && git commit -m "feat(angular): componente Alert con variantes de estado"`

---

### Task 5: `ThemeService`

**Files:**
- Create: `src/app/core/theme/theme.service.ts`
- Modify: `src/app/app.config.ts`
- Test: `src/app/core/theme/theme.service.spec.ts`

**Interfaces:**
- Produces: `type Theme = 'dark' | 'light'`; `THEME_STORAGE_KEY = 'zen_inventory_theme'`; `ThemeService` (`providedIn: 'root'`): `theme: Signal<Theme>`, `isDark: Signal<boolean>`, `set(theme: Theme): void`, `toggle(): void`. Aplica `data-theme` en `<html>`; persiste en una sola clave; tolera `localStorage` inaccesible o con valores inválidos (usa `'dark'`).

- [ ] **Step 1: Escribir el test (rojo)**

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

function createService(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });
  afterEach(() => vi.restoreAllMocks());

  it('por defecto usa el tema oscuro y lo aplica al documento', () => {
    const service = createService();
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('restaura el tema guardado', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const service = createService();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('ignora un valor guardado inválido', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'azul');
    expect(createService().theme()).toBe('dark');
  });

  it('toggle() alterna, persiste y actualiza el documento', () => {
    const service = createService();
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('arranca en oscuro si localStorage lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createService().theme()).toBe('dark');
  });

  it('toggle() funciona en memoria aunque no pueda persistir', () => {
    const service = createService();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => service.toggle()).not.toThrow();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla** — FAIL `Could not resolve "./theme.service"`.

- [ ] **Step 3: Implementar `theme.service.ts`**

```ts
import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'zen_inventory_theme';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Almacenamiento no disponible: el tema sigue vigente solo en memoria.
  }
}

/** Tema claro/oscuro. Se refleja en `<html data-theme>`, que activa los tokens de `theme.css`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly state = signal<Theme>(readStoredTheme());

  readonly theme = this.state.asReadonly();
  readonly isDark = computed(() => this.state() === 'dark');

  constructor() {
    this.apply(this.state());
  }

  set(theme: Theme): void {
    this.state.set(theme);
    this.apply(theme);
    writeStoredTheme(theme);
  }

  toggle(): void {
    this.set(this.state() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    this.root.dataset['theme'] = theme;
  }
}
```

- [ ] **Step 4: Inicializar el tema al arrancar la app**

En `src/app/app.config.ts` importar `inject, provideAppInitializer` de `@angular/core` y `ThemeService` de `./core/theme/theme.service`, y agregar a `providers`:

```ts
    // Aplica el tema guardado antes de mostrar cualquier pantalla (también el login).
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
```

- [ ] **Step 5: Ejecutar y comprobar que pasa** — `npm test -- --watch=false && npm run lint && npm run build` → PASS.

- [ ] **Step 6: Commit** — `git add frontend-angular && git commit -m "feat(angular): ThemeService con persistencia tolerante a fallos"`

---

### Task 6: Roles, `roleGuard` y `guestGuard`

**Files:**
- Create: `src/app/core/auth/role.ts`, `src/app/core/auth/role.guard.ts`, `src/app/core/auth/guest.guard.ts`
- Modify: `src/app/core/auth/auth-urls.ts`, `src/app/core/auth/auth-store.ts`
- Test: `src/app/core/auth/role.spec.ts`, `src/app/core/auth/role.guard.spec.ts`, `src/app/core/auth/guest.guard.spec.ts`, `src/app/core/auth/auth-store.spec.ts` (agrega casos)

**Interfaces:**
- Consumes: `AuthStore` (`session`, `isAuthenticated`, `clear`), `LOGIN_URL`.
- Produces:
  - `ROLES = ['ADMIN','MANAGER','SELLER','OPERADOR_INVENTARIO'] as const`; `type Role`; `isRole(value: unknown): value is Role`.
  - `DASHBOARD_URL = '/dashboard'` (en `auth-urls.ts`).
  - `AuthStore.role: Signal<Role | null>` (`null` si no hay sesión o el rol no es conocido).
  - `roleGuard(...allowed: Role[]): CanActivateFn`: sin sesión → `/login`; rol **desconocido** → limpia la sesión y `/login` (evita bucles); rol no permitido → `/dashboard`; permitido → `true`.
  - `guestGuard: CanActivateFn`: con sesión → `/dashboard`; sin sesión → `true`.

- [ ] **Step 1: Escribir los tests (rojo)**

`src/app/core/auth/role.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ROLES, isRole } from './role';

describe('isRole', () => {
  it.each(ROLES)('reconoce %s', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([['admin'], ['INVENTADO'], [''], [null], [undefined], [5], [{}]])(
    'rechaza %j',
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );

  it('contempla los cuatro roles del backend', () => {
    expect([...ROLES].sort()).toEqual(['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO', 'SELLER']);
  });
});
```

Agregar a `src/app/core/auth/auth-store.spec.ts`, dentro del `describe('AuthStore')`:

```ts
  it('role expone el rol conocido de la sesión y null si no hay sesión', () => {
    const store = createStore();
    expect(store.role()).toBeNull();
    store.start(session);
    expect(store.role()).toBe('ADMIN');
  });

  it('role es null cuando el rol de la sesión no es uno conocido', () => {
    const store = createStore();
    store.start({ ...session, rol: 'INVENTADO' });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBeNull();
  });
```

`src/app/core/auth/role.guard.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth-store';
import { roleGuard } from './role.guard';

const run = (...allowed: Parameters<typeof roleGuard>) =>
  TestBed.runInInjectionContext(() =>
    roleGuard(...allowed)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );

const sessionWith = (rol: string) => ({ token: 't', email: 'e', nombre: 'n', rol, id: 1 });

describe('roleGuard', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    // Doble mínimo: devuelve los comandos para poder afirmar el destino sin armar rutas reales.
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
    store = TestBed.inject(AuthStore);
  });

  it('permite el paso a un rol incluido', () => {
    store.start(sessionWith('MANAGER'));
    expect(run('ADMIN', 'MANAGER')).toBe(true);
  });

  it('redirige al panel si el rol no está incluido', () => {
    store.start(sessionWith('OPERADOR_INVENTARIO'));
    expect(run('ADMIN')).toEqual(['/dashboard']);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    expect(run('ADMIN')).toEqual(['/login']);
  });

  it('con un rol desconocido cierra la sesión y redirige a /login (evita bucles)', () => {
    store.start(sessionWith('INVENTADO'));
    expect(run('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')).toEqual(['/login']);
    expect(store.isAuthenticated()).toBe(false);
  });
});
```

`src/app/core/auth/guest.guard.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth-store';
import { guestGuard } from './guest.guard';

const run = () =>
  TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

describe('guestGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
  });

  it('permite entrar al login sin sesión', () => {
    expect(run()).toBe(true);
  });

  it('con sesión redirige al panel', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'ADMIN', id: 1 });
    expect(run()).toEqual(['/dashboard']);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan** — `npm test -- --watch=false` → FAIL (`./role`, `./role.guard`, `./guest.guard` inexistentes; `store.role` no existe).

- [ ] **Step 3: Implementar `role.ts`**

```ts
/** Roles del backend (`Role.java`). */
export const ROLES = ['ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Ampliar `auth-urls.ts` y `AuthStore`**

En `auth-urls.ts` agregar:

```ts
/** Pantalla principal tras iniciar sesión. */
export const DASHBOARD_URL = '/dashboard';
```

En `auth-store.ts` importar `isRole, type Role` de `./role` y agregar junto a `token`:

```ts
  /** Rol de la sesión si es uno de los que la app conoce; null si no hay sesión o el rol es desconocido. */
  readonly role = computed<Role | null>(() => {
    const rol = this.state()?.rol;
    return isRole(rol) ? rol : null;
  });
```

- [ ] **Step 5: Implementar las guardas**

`role.guard.ts`:

```ts
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { DASHBOARD_URL, LOGIN_URL } from './auth-urls';
import { AuthStore } from './auth-store';
import type { Role } from './role';

/**
 * Restringe una ruta a ciertos roles. Una sesión sin rol reconocido se considera inválida:
 * se cierra y se vuelve al login (redirigir al panel crearía un bucle, porque el panel también valida el rol).
 */
export const roleGuard =
  (...allowed: Role[]): CanActivateFn =>
  () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    const role = store.role();
    if (role === null) {
      store.clear();
      return router.createUrlTree([LOGIN_URL]);
    }
    return allowed.includes(role) ? true : router.createUrlTree([DASHBOARD_URL]);
  };
```

`guest.guard.ts`:

```ts
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { DASHBOARD_URL } from './auth-urls';
import { AuthStore } from './auth-store';

/** Para pantallas públicas (login): quien ya tiene sesión va directo al panel. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthStore).isAuthenticated() ? inject(Router).createUrlTree([DASHBOARD_URL]) : true;
```

- [ ] **Step 6: Ejecutar y comprobar que pasan** — `npm test -- --watch=false && npm run lint` → PASS.

- [ ] **Step 7: Mutación de comprobación**

En `role.guard.ts` quitar `store.clear();` y ejecutar: debe fallar "con un rol desconocido cierra la sesión…". Restaurar.

- [ ] **Step 8: Commit** — `git add frontend-angular && git commit -m "feat(angular): roles del backend, roleGuard y guestGuard"`

---

### Task 7: Configuración del menú (`NAV_SECTIONS`)

**Files:**
- Create: `src/app/layout/nav-items.ts`
- Test: `src/app/layout/nav-items.spec.ts`

**Interfaces:**
- Consumes: `Role`, `ROLES`.
- Produces:
  - `interface NavItem { label: string; path: string; icon: LucideIconData; roles: readonly Role[] }` (`path` con `/` inicial, p. ej. `/inventory`).
  - `interface NavSection { title: string; items: readonly NavItem[] }`.
  - `NAV_SECTIONS: readonly NavSection[]`: secciones "Navegación" y "Maestros".
  - `navSectionsFor(role: Role | null): NavSection[]`: secciones con los ítems permitidos al rol (descarta secciones vacías; `null` → `[]`).
- Reglas (paridad con `Sidebar.tsx` del Next):
  - ADMIN ve todo, incluida "Maestros".
  - OPERADOR_INVENTARIO ve solo: Panel, Inventario, Traslados, Compras, Ventas, Historial Ventas, Devoluciones.
  - MANAGER y SELLER ven todo "Navegación" (incluye Alertas, Sucursales, Usuarios, Auditoría Global) y no ven "Maestros". **Es el comportamiento actual del Next; ver Task 12 (se reporta, no se cambia).**

- [ ] **Step 1: Escribir el test (rojo)**

```ts
import { describe, expect, it } from 'vitest';
import { ROLES } from '@core/auth/role';
import { NAV_SECTIONS, navSectionsFor } from './nav-items';

const labels = (role: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(role).flatMap((section) => section.items.map((item) => item.label));

const allItems = NAV_SECTIONS.flatMap((section) => section.items);

describe('NAV_SECTIONS', () => {
  it('no repite rutas', () => {
    const paths = allItems.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('todas las rutas empiezan por / y tienen al menos un rol', () => {
    for (const item of allItems) {
      expect(item.path.startsWith('/')).toBe(true);
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });

  it('el Panel es accesible para todos los roles (destino de las redirecciones de guarda)', () => {
    const dashboard = allItems.find((item) => item.path === '/dashboard');
    expect([...(dashboard?.roles ?? [])].sort()).toEqual([...ROLES].sort());
  });
});

describe('navSectionsFor', () => {
  it('ADMIN ve todo, incluidos los maestros', () => {
    expect(labels('ADMIN')).toEqual(allItems.map((item) => item.label));
    expect(navSectionsFor('ADMIN').map((section) => section.title)).toEqual(['Navegación', 'Maestros']);
  });

  it('OPERADOR_INVENTARIO solo ve las pantallas operativas', () => {
    expect(labels('OPERADOR_INVENTARIO')).toEqual([
      'Panel',
      'Inventario',
      'Traslados',
      'Compras',
      'Ventas',
      'Historial Ventas',
      'Devoluciones',
    ]);
    expect(navSectionsFor('OPERADOR_INVENTARIO').map((section) => section.title)).toEqual(['Navegación']);
  });

  it.each(['MANAGER', 'SELLER'] as const)('%s ve toda la navegación y ningún maestro', (role) => {
    const visible = labels(role);
    expect(visible).toContain('Usuarios');
    expect(visible).toContain('Alertas');
    expect(visible).not.toContain('Productos');
    expect(navSectionsFor(role).map((section) => section.title)).toEqual(['Navegación']);
  });

  it('sin rol no muestra nada', () => {
    expect(navSectionsFor(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla** — FAIL `Could not resolve "./nav-items"`.

- [ ] **Step 3: Implementar `nav-items.ts`**

Verificar primero que el tipo se exporta: `grep -n "export type LucideIconData" node_modules/@lucide/angular/types/lucide-angular.d.ts`. Si el nombre difiere, usar el que exporte el paquete.

```ts
import {
  LucideBell,
  LucideFileText,
  LucideLayers,
  LucideLayoutDashboard,
  LucidePackage,
  LucideReceipt,
  LucideRotateCcwClock,
  LucideRuler,
  LucideShoppingBag,
  LucideShuffle,
  LucideStore,
  LucideTruck,
  LucideUndo2,
  LucideUsers,
  type LucideIconData,
} from '@lucide/angular';
import { ROLES, type Role } from '@core/auth/role';

export interface NavItem {
  readonly label: string;
  /** Ruta absoluta de la app (con `/` inicial). */
  readonly path: string;
  readonly icon: LucideIconData;
  readonly roles: readonly Role[];
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const EVERYONE: readonly Role[] = ROLES;
const MANAGEMENT: readonly Role[] = ['ADMIN', 'MANAGER', 'SELLER'];
const ADMIN_ONLY: readonly Role[] = ['ADMIN'];

/** Fuente única del menú y de las rutas protegidas del shell. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Navegación',
    items: [
      { label: 'Panel', path: '/dashboard', icon: LucideLayoutDashboard.icon, roles: EVERYONE },
      { label: 'Inventario', path: '/inventory', icon: LucideLayers.icon, roles: EVERYONE },
      { label: 'Alertas', path: '/alerts', icon: LucideBell.icon, roles: MANAGEMENT },
      { label: 'Traslados', path: '/transfers', icon: LucideShuffle.icon, roles: EVERYONE },
      { label: 'Compras', path: '/purchases', icon: LucideShoppingBag.icon, roles: EVERYONE },
      { label: 'Ventas', path: '/sales/pos', icon: LucideReceipt.icon, roles: EVERYONE },
      { label: 'Historial Ventas', path: '/sales/history', icon: LucideRotateCcwClock.icon, roles: EVERYONE },
      { label: 'Devoluciones', path: '/returns', icon: LucideUndo2.icon, roles: EVERYONE },
      { label: 'Sucursales', path: '/branches', icon: LucideStore.icon, roles: MANAGEMENT },
      { label: 'Usuarios', path: '/users', icon: LucideUsers.icon, roles: MANAGEMENT },
      { label: 'Auditoría Global', path: '/audit', icon: LucideFileText.icon, roles: MANAGEMENT },
    ],
  },
  {
    title: 'Maestros',
    items: [
      { label: 'Productos', path: '/catalog/products', icon: LucidePackage.icon, roles: ADMIN_ONLY },
      { label: 'Proveedores', path: '/catalog/suppliers', icon: LucideTruck.icon, roles: ADMIN_ONLY },
      { label: 'Unidades de medida', path: '/catalog/units', icon: LucideRuler.icon, roles: ADMIN_ONLY },
    ],
  },
];

/** Secciones del menú visibles para un rol; descarta las que quedan vacías. */
export function navSectionsFor(role: Role | null): NavSection[] {
  if (role === null) return [];
  return NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa** — `npm test -- --watch=false && npm run lint && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git add frontend-angular && git commit -m "feat(angular): configuración declarativa del menú con roles por ítem"`

---

### Task 8: `SidebarState` y `BranchLabelApi`

**Files:**
- Create: `src/app/layout/sidebar-state.ts`, `src/app/layout/data-access/branch-label-api.ts`
- Test: `src/app/layout/sidebar-state.spec.ts`, `src/testing/integration/branch-label-api.integration.spec.ts`

**Interfaces:**
- Consumes: `API_BASE_URL`, `AuthSession`, tipos de `schema.d.ts` (`components['schemas']['BranchResponse']`, campos opcionales).
- Produces:
  - `SIDEBAR_STORAGE_KEY = 'zen_inventory_sidebar_collapsed'`; `SidebarState` (`providedIn: 'root'`): `collapsed: Signal<boolean>`, `toggle(): void` (persiste `'true'|'false'`; tolera storage inaccesible).
  - `GLOBAL_LABEL = 'Gestión Global'`, `DEFAULT_BRANCH_LABEL = 'Zen Inventory'`; `BranchLabelApi.labelFor(session: AuthSession): Observable<string>`: ADMIN → `GLOBAL_LABEL` sin llamar al backend; sin `sucursalId` → `DEFAULT_BRANCH_LABEL`; si no, `GET {base}/api/branches/{sucursalId}` → `nombre` recortado; error o nombre vacío → `DEFAULT_BRANCH_LABEL`.

- [ ] **Step 1: Escribir los tests (rojo)**

`src/app/layout/sidebar-state.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_STORAGE_KEY, SidebarState } from './sidebar-state';

function createState(): SidebarState {
  TestBed.resetTestingModule();
  return TestBed.inject(SidebarState);
}

describe('SidebarState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('por defecto está expandido', () => {
    expect(createState().collapsed()).toBe(false);
  });

  it('restaura el estado colapsado guardado', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
    expect(createState().collapsed()).toBe(true);
  });

  it('toggle() alterna y persiste', () => {
    const state = createState();
    state.toggle();
    expect(state.collapsed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    state.toggle();
    expect(state.collapsed()).toBe(false);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
  });

  it('arranca expandido si localStorage lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createState().collapsed()).toBe(false);
  });

  it('toggle() funciona en memoria aunque no pueda persistir', () => {
    const state = createState();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => state.toggle()).not.toThrow();
    expect(state.collapsed()).toBe(true);
  });
});
```

`src/testing/integration/branch-label-api.integration.spec.ts`:

```ts
import { provideHttpClient, withFetch } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import type { AuthSession } from '@core/auth/auth-session';
import {
  BranchLabelApi,
  DEFAULT_BRANCH_LABEL,
  GLOBAL_LABEL,
} from '../../app/layout/data-access/branch-label-api';
import { server, TEST_API } from '../msw-server';

const session = (overrides: Partial<AuthSession>): AuthSession => ({
  token: 't',
  email: 'e@z.com',
  nombre: 'Ana',
  rol: 'MANAGER',
  id: 1,
  ...overrides,
});

describe('BranchLabelApi (contrato HTTP con MSW)', () => {
  let api: BranchLabelApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), { provide: API_BASE_URL, useValue: TEST_API }],
    });
    api = TestBed.inject(BranchLabelApi);
  });

  it('un ADMIN ve "Gestión Global" sin llamar al backend', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_API}/api/branches/:id`, () => {
        calls++;
        return HttpResponse.json({ nombre: 'Norte' });
      }),
    );
    expect(await firstValueFrom(api.labelFor(session({ rol: 'ADMIN', sucursalId: 3 })))).toBe(GLOBAL_LABEL);
    expect(calls).toBe(0);
  });

  it('un usuario de sucursal ve el nombre de su sucursal', async () => {
    server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.json({ id: 3, nombre: '  Norte  ' })));
    expect(await firstValueFrom(api.labelFor(session({ sucursalId: 3 })))).toBe('Norte');
  });

  it('sin sucursalId usa la etiqueta por defecto sin llamar al backend', async () => {
    expect(await firstValueFrom(api.labelFor(session({})))).toBe(DEFAULT_BRANCH_LABEL);
  });

  it.each([
    ['404', () => new HttpResponse(null, { status: 404 })],
    ['500', () => new HttpResponse(null, { status: 500 })],
    ['error de red', () => HttpResponse.error()],
    ['nombre vacío', () => HttpResponse.json({ id: 3, nombre: '   ' })],
    ['sin nombre', () => HttpResponse.json({ id: 3 })],
  ])('ante %s usa la etiqueta por defecto', async (_caso, responder) => {
    server.use(http.get(`${TEST_API}/api/branches/3`, responder));
    expect(await firstValueFrom(api.labelFor(session({ sucursalId: 3 })))).toBe(DEFAULT_BRANCH_LABEL);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan** — FAIL por módulos inexistentes.

- [ ] **Step 3: Implementar `sidebar-state.ts`**

```ts
import { Injectable, signal } from '@angular/core';

export const SIDEBAR_STORAGE_KEY = 'zen_inventory_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // Almacenamiento no disponible: el estado sigue vigente solo en memoria.
  }
}

/** Estado colapsado/expandido del sidebar, persistido entre sesiones. */
@Injectable({ providedIn: 'root' })
export class SidebarState {
  private readonly state = signal(readCollapsed());

  readonly collapsed = this.state.asReadonly();

  toggle(): void {
    const next = !this.state();
    this.state.set(next);
    writeCollapsed(next);
  }
}
```

- [ ] **Step 4: Implementar `branch-label-api.ts`**

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import type { components } from '@core/api/schema';
import type { AuthSession } from '@core/auth/auth-session';

type BranchResponse = components['schemas']['BranchResponse'];

export const GLOBAL_LABEL = 'Gestión Global';
export const DEFAULT_BRANCH_LABEL = 'Zen Inventory';

/** Texto que identifica el ámbito del usuario en la tarjeta del sidebar. Nunca falla: degrada a la etiqueta por defecto. */
@Injectable({ providedIn: 'root' })
export class BranchLabelApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  labelFor(session: AuthSession): Observable<string> {
    if (session.rol === 'ADMIN') return of(GLOBAL_LABEL);
    if (session.sucursalId === undefined) return of(DEFAULT_BRANCH_LABEL);
    return this.http.get<BranchResponse>(`${this.baseUrl}/api/branches/${session.sucursalId}`).pipe(
      map((branch) => branch.nombre?.trim() || DEFAULT_BRANCH_LABEL),
      catchError(() => of(DEFAULT_BRANCH_LABEL)),
    );
  }
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasan** — `npm test -- --watch=false && npm run lint` → PASS.

- [ ] **Step 6: Commit** — `git add frontend-angular && git commit -m "feat(angular): SidebarState y BranchLabelApi tolerante a fallos"`

---

### Task 9: `UserCard`, `Sidebar` y `Shell`

**Files:**
- Create: `src/app/layout/user-card.ts`, `src/app/layout/sidebar.ts`, `src/app/layout/sidebar.html`, `src/app/layout/shell.ts`
- Test: `src/app/layout/user-card.spec.ts`, `src/app/layout/sidebar.spec.ts`

**Interfaces:**
- Consumes: `AuthStore`, `ThemeService`, `SidebarState`, `BranchLabelApi`, `navSectionsFor`, `Logo`, `LOGIN_URL`.
- Produces:
  - `UserCard` (`app-user-card`): sin sesión no renderiza nada; con sesión muestra la inicial del nombre (o `U`), el nombre y la etiqueta de sucursal. Input `compact: boolean` oculta nombre y etiqueta (sidebar colapsado).
  - `Sidebar` (`app-sidebar`): `<nav aria-label="Principal">` con los ítems del rol; cada enlace con `aria-label` = etiqueta y `aria-current="page"` cuando está activo; botón "Contraer menú"/"Expandir menú" (`aria-expanded`); botón de tema "Modo claro"/"Modo oscuro"; botón "Cerrar sesión" que limpia la sesión y navega a `/login`.
  - `Shell` (`app-shell`): `Sidebar` + `<main>` con `<router-outlet />`.

- [ ] **Step 1: Escribir los tests (rojo)**

`src/app/layout/user-card.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '@core/auth/auth-store';
import { BranchLabelApi } from './data-access/branch-label-api';
import { UserCard } from './user-card';

const provideLabel = (label: string) => ({ provide: BranchLabelApi, useValue: { labelFor: () => of(label) } });

describe('UserCard', () => {
  beforeEach(() => localStorage.clear());

  it('sin sesión no muestra nada', async () => {
    const { container } = await render(UserCard, { providers: [provideLabel('Norte')] });
    expect(container).toHaveTextContent('');
  });

  it('muestra la inicial, el nombre y la sucursal', async () => {
    await render(UserCard, {
      providers: [provideLabel('Sucursal Norte')],
      configureTestBed: (bed) =>
        bed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'ana pérez', rol: 'MANAGER', id: 1, sucursalId: 3 }),
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('ana pérez')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument();
  });

  it('sin nombre usa "U" como inicial', async () => {
    await render(UserCard, {
      providers: [provideLabel('Zen Inventory')],
      configureTestBed: (bed) =>
        bed.inject(AuthStore).start({ token: 't', email: 'e', nombre: '', rol: 'MANAGER', id: 1 }),
    });
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('en modo compacto solo muestra la inicial', async () => {
    await render(UserCard, {
      inputs: { compact: true },
      providers: [provideLabel('Sucursal Norte')],
      configureTestBed: (bed) =>
        bed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'Ana', rol: 'MANAGER', id: 1, sucursalId: 3 }),
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('Sucursal Norte')).not.toBeInTheDocument();
  });
});
```

`src/app/layout/sidebar.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { BranchLabelApi } from './data-access/branch-label-api';
import { SIDEBAR_STORAGE_KEY } from './sidebar-state';
import { Sidebar } from './sidebar';

const sessionFor = (rol: string) => ({ token: 't', email: 'e', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

async function renderSidebar(rol: string) {
  return render(Sidebar, {
    providers: [
      provideRouter([]),
      { provide: BranchLabelApi, useValue: { labelFor: () => of('Norte') } },
    ],
    configureTestBed: (bed) => bed.inject(AuthStore).start(sessionFor(rol)),
  });
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('un ADMIN ve la navegación completa y los maestros', async () => {
    await renderSidebar('ADMIN');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).toBeInTheDocument();
    for (const name of ['Panel', 'Inventario', 'Usuarios', 'Productos', 'Proveedores', 'Unidades de medida']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Maestros')).toBeInTheDocument();
  });

  it('un OPERADOR_INVENTARIO no ve administración ni maestros', async () => {
    await renderSidebar('OPERADOR_INVENTARIO');
    expect(screen.getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    for (const name of ['Usuarios', 'Alertas', 'Productos', 'Sucursales']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Maestros')).not.toBeInTheDocument();
  });

  it('cada enlace apunta a su ruta', async () => {
    await renderSidebar('ADMIN');
    expect(screen.getByRole('link', { name: 'Historial Ventas' })).toHaveAttribute('href', '/sales/history');
  });

  it('muestra la tarjeta del usuario con su sucursal', async () => {
    await renderSidebar('MANAGER');
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Norte')).toBeInTheDocument();
  });

  it('colapsar conserva los nombres accesibles de los enlaces y persiste el estado', async () => {
    await renderSidebar('ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
  });

  it('el botón de tema alterna entre oscuro y claro', async () => {
    await renderSidebar('ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Modo claro' }));
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Modo oscuro' })).toBeInTheDocument();
  });

  it('cerrar sesión limpia la sesión y navega al login', async () => {
    await renderSidebar('ADMIN');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que fallan** — FAIL (`./user-card`, `./sidebar` inexistentes).

- [ ] **Step 3: Implementar `user-card.ts`**

```ts
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideMapPin } from '@lucide/angular';
import { of, switchMap } from 'rxjs';
import { AuthStore } from '@core/auth/auth-store';
import { BranchLabelApi, DEFAULT_BRANCH_LABEL } from './data-access/branch-label-api';

/** Datos del usuario en sesión: inicial, nombre y ámbito (sucursal o gestión global). */
@Component({
  selector: 'app-user-card',
  imports: [LucideMapPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (session(); as current) {
      <div class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-card p-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand to-warning text-[13px] font-black text-white"
          aria-hidden="true"
        >
          {{ initial() }}
        </div>
        @if (!compact()) {
          <div class="min-w-0">
            <p class="truncate text-[13px] font-bold text-fg">{{ current.nombre }}</p>
            <p class="mt-0.5 flex items-center gap-1 text-[10px] text-fg-subtle">
              <svg lucideMapPin [size]="10" class="shrink-0" />
              <span class="truncate">{{ label() }}</span>
            </p>
          </div>
        }
      </div>
    }
  `,
})
export class UserCard {
  readonly compact = input(false);

  private readonly api = inject(BranchLabelApi);
  protected readonly session = inject(AuthStore).session;

  protected readonly initial = computed(() => this.session()?.nombre.charAt(0).toUpperCase() || 'U');
  protected readonly label = toSignal(
    toObservable(this.session).pipe(
      switchMap((current) => (current ? this.api.labelFor(current) : of(DEFAULT_BRANCH_LABEL))),
    ),
    { initialValue: DEFAULT_BRANCH_LABEL },
  );
}
```

- [ ] **Step 4: Implementar `sidebar.ts`**

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideLogOut,
  LucideMoon,
  LucideSun,
  LucideDynamicIcon,
} from '@lucide/angular';
import { LOGIN_URL } from '@core/auth/auth-urls';
import { AuthStore } from '@core/auth/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { Logo } from '@shared/ui/logo';
import { navSectionsFor } from './nav-items';
import { SidebarState } from './sidebar-state';
import { UserCard } from './user-card';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    Logo,
    UserCard,
    LucideDynamicIcon,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLogOut,
    LucideMoon,
    LucideSun,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 z-40 block h-dvh shrink-0' },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly state = inject(SidebarState);

  protected readonly sections = computed(() => navSectionsFor(this.store.role()));

  protected logout(): void {
    this.store.clear();
    void this.router.navigateByUrl(LOGIN_URL);
  }
}
```

Nota: `LucideDynamicIcon` (selector `svg[lucideIcon]`) pinta un icono recibido como dato, que es lo que necesita el menú configurable.

- [ ] **Step 5: Implementar `sidebar.html`**

```html
<aside
  class="flex h-full flex-col border-r border-line bg-base py-5 transition-[width] duration-300"
  [class]="state.collapsed() ? 'w-20' : 'w-60'"
>
  <header class="relative mb-6 flex items-center gap-2.5 px-4" [class.justify-center]="state.collapsed()">
    <app-logo [size]="32" [showText]="!state.collapsed()" />
    <button
      type="button"
      class="absolute top-2 -right-3 flex size-6 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [attr.aria-label]="state.collapsed() ? 'Expandir menú' : 'Contraer menú'"
      [attr.aria-expanded]="!state.collapsed()"
      (click)="state.toggle()"
    >
      @if (state.collapsed()) {
        <svg lucideChevronRight [size]="14" />
      } @else {
        <svg lucideChevronLeft [size]="14" />
      }
    </button>
  </header>

  <nav aria-label="Principal" class="custom-scrollbar flex-1 overflow-y-auto px-3">
    @for (section of sections(); track section.title) {
      <p
        class="mt-4 mb-2 px-3 text-[10px] font-bold tracking-widest text-fg-subtle uppercase first:mt-0"
        [class.text-center]="state.collapsed()"
      >
        {{ state.collapsed() ? '—' : section.title }}
      </p>
      <ul class="flex flex-col gap-0.5">
        @for (item of section.items; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-card font-semibold text-fg"
              ariaCurrentWhenActive="page"
              class="flex items-center gap-3 rounded-md py-2.5 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
              [class]="state.collapsed() ? 'justify-center px-3' : 'px-3'"
              [attr.aria-label]="item.label"
              [attr.title]="state.collapsed() ? item.label : null"
            >
              <svg [lucideIcon]="item.icon" [size]="18" [strokeWidth]="1.8" class="shrink-0" />
              @if (!state.collapsed()) {
                <span class="truncate">{{ item.label }}</span>
              }
            </a>
          </li>
        }
      </ul>
    }
  </nav>

  <footer class="flex flex-col gap-1 px-3 pt-3">
    <button
      type="button"
      class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [class.justify-center]="state.collapsed()"
      [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'"
      (click)="theme.toggle()"
    >
      @if (theme.isDark()) {
        <svg lucideSun [size]="18" class="shrink-0" />
      } @else {
        <svg lucideMoon [size]="18" class="shrink-0" />
      }
      @if (!state.collapsed()) {
        <span>{{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}</span>
      }
    </button>

    <app-user-card [compact]="state.collapsed()" />

    <button
      type="button"
      class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [class.justify-center]="state.collapsed()"
      aria-label="Cerrar sesión"
      (click)="logout()"
    >
      <svg lucideLogOut [size]="18" class="shrink-0" />
      @if (!state.collapsed()) {
        <span>Cerrar sesión</span>
      }
    </button>
  </footer>
</aside>
```

- [ ] **Step 6: Implementar `shell.ts`**

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './sidebar';

/** Estructura de las pantallas autenticadas: menú lateral + contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh bg-surface' },
  template: `
    <app-sidebar />
    <main class="min-w-0 flex-1 pb-10">
      <router-outlet />
    </main>
  `,
})
export class Shell {}
```

- [ ] **Step 7: Ejecutar y comprobar que pasan** — `npm test -- --watch=false && npm run lint && npm run build` → PASS. Si `routerLinkActive` + clases dinámicas `[class]` se pisan en el DOM, usar `[ngClass]`-equivalente con `[class.xxx]` y registrar el ajuste.

- [ ] **Step 8: Mutación de comprobación**

En `sidebar.ts`, cambiar `navSectionsFor(this.store.role())` por `NAV_SECTIONS` (importándolo): debe fallar "un OPERADOR_INVENTARIO no ve administración ni maestros". Restaurar.

- [ ] **Step 9: Commit** — `git add frontend-angular && git commit -m "feat(angular): Sidebar por rol, UserCard y Shell"`

---

### Task 10: `LoginPage`

**Files:**
- Create: `src/app/features/auth/pages/login-page.ts`, `src/app/features/auth/pages/login-page.html`
- Test: `src/app/features/auth/pages/login-page.spec.ts`

**Interfaces:**
- Consumes: `AuthApi.login`, `AuthError`, `DASHBOARD_URL`, `Button`, `FormField`, `InputDirective`, `PasswordToggle`, `Alert`, `Logo`.
- Produces: `LoginPage` (`app-login-page`). Formulario `NonNullableFormBuilder` con `email` (requerido, patrón `^[^\s@]+@[^\s@]+\.[^\s@]+$`) y `password` (requerido, mínimo 6). Mensajes: "El correo es requerido.", "Correo inválido.", "La contraseña es requerida.", "Mínimo 6 caracteres." (solo tras `touched` o intento de envío). Envío: una sola petición mientras haya una en curso; durante el envío campos y botón deshabilitados y botón "Verificando…"; éxito → `navigateByUrl('/dashboard')`; fallo → `Alert` con `AuthError.message` (o "Error inesperado."), formulario habilitado, el error se limpia al editar.

- [ ] **Step 1: Escribir el test (rojo)**

```ts
import { provideHttpClient, withFetch } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/auth-store';
import { okLogin, server, TEST_API } from '../../../../testing/msw-server';
import { LoginPage } from './login-page';

const LOGIN = `${TEST_API}/api/auth/login`;

async function renderLogin() {
  const result = await render(LoginPage, {
    providers: [
      provideRouter([]),
      provideHttpClient(withFetch()),
      { provide: API_BASE_URL, useValue: TEST_API },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return { ...result, navigate };
}

const emailInput = () => screen.getByLabelText('Correo electrónico');
const passwordInput = () => screen.getByLabelText('Contraseña');
const submitButton = () => screen.getByRole('button', { name: /Ingresar al sistema|Verificando/ });

async function fillValid() {
  await userEvent.type(emailInput(), 'ana@zen.com');
  await userEvent.type(passwordInput(), 'secreto1');
}

describe('LoginPage', () => {
  beforeEach(() => localStorage.clear());

  it('muestra el formulario sin cuentas demo', async () => {
    await renderLogin();
    expect(screen.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
    expect(emailInput()).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('al enviar vacío muestra los errores y no llama al backend', async () => {
    let calls = 0;
    server.use(http.post(LOGIN, () => { calls++; return HttpResponse.json(okLogin); }));
    await renderLogin();
    await userEvent.click(submitButton());
    expect(screen.getByText('El correo es requerido.')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida.')).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('valida el formato del correo al salir del campo', async () => {
    await renderLogin();
    await userEvent.type(emailInput(), 'sin-arroba');
    await userEvent.tab();
    expect(screen.getByText('Correo inválido.')).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('valida la longitud mínima de la contraseña', async () => {
    await renderLogin();
    await userEvent.type(passwordInput(), '123');
    await userEvent.tab();
    expect(screen.getByText('Mínimo 6 caracteres.')).toBeInTheDocument();
  });

  it('no muestra errores antes de que el usuario toque el campo', async () => {
    await renderLogin();
    await userEvent.type(emailInput(), 'sin');
    expect(screen.queryByText('Correo inválido.')).not.toBeInTheDocument();
  });

  it('con credenciales válidas inicia sesión y navega al panel', async () => {
    let received: unknown;
    server.use(http.post(LOGIN, async ({ request }) => { received = await request.json(); return HttpResponse.json(okLogin); }));
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'));
    expect(received).toEqual({ email: 'ana@zen.com', password: 'secreto1' });
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(true);
  });

  it('con credenciales incorrectas muestra el mensaje del backend y deja reintentar', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 })));
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas');
    expect(navigate).not.toHaveBeenCalled();
    expect(emailInput()).toBeEnabled();
    expect(passwordInput()).toHaveValue('secreto1');
  });

  it('muestra el error de servidor con su propio mensaje', async () => {
    server.use(http.post(LOGIN, () => new HttpResponse(null, { status: 500 })));
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no pudo procesar la solicitud.');
  });

  it('el error del servidor desaparece al editar un campo', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 })));
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    await screen.findByRole('alert');
    await userEvent.type(passwordInput(), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('durante el envío deshabilita el formulario y muestra "Verificando…"', async () => {
    server.use(http.post(LOGIN, async () => { await delay(150); return HttpResponse.json(okLogin); }));
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    const busy = await screen.findByRole('button', { name: /Verificando/ });
    expect(busy).toBeDisabled();
    expect(emailInput()).toBeDisabled();
    expect(passwordInput()).toBeDisabled();
  });

  it('un doble clic envía una sola petición', async () => {
    let calls = 0;
    server.use(http.post(LOGIN, async () => { calls++; await delay(150); return HttpResponse.json(okLogin); }));
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.dblClick(submitButton());
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls).toBe(1);
  });

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    await renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(passwordInput()).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(passwordInput()).toHaveAttribute('type', 'password');
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla** — FAIL `Could not resolve "./login-page"`.

- [ ] **Step 3: Implementar `login-page.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLock, LucideMail } from '@lucide/angular';
import { AuthApi, AuthError } from '@core/auth/auth-api';
import { DASHBOARD_URL } from '@core/auth/auth-urls';
import { Alert } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { FormField, InputDirective } from '@shared/ui/form-field';
import { Logo } from '@shared/ui/logo';
import { PasswordToggle } from '@shared/ui/password-toggle';

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
```

- [ ] **Step 4: Implementar `login-page.html`**

```html
<div class="flex min-h-dvh bg-base">
  <section
    class="hidden flex-1 flex-col items-center justify-center gap-6 border-r border-line bg-surface p-12 text-center md:flex"
  >
    <app-logo [size]="120" />
    <h1 class="font-serif text-5xl font-bold tracking-tight text-fg">Zen Inventory</h1>
    <p class="font-serif text-2xl font-medium text-brand-soft italic">
      Gestiona tu inventario con inteligencia.
    </p>
    <p class="max-w-[460px] text-base leading-relaxed text-fg-subtle">
      Sistema multi-sucursal con alertas proactivas, trazabilidad completa y analítica en tiempo real.
    </p>
    <p class="text-[13px] text-fg-subtle">© {{ year }} Zen Inventory Logic</p>
  </section>

  <section class="flex flex-1 items-center justify-center p-6">
    <div class="w-full max-w-[380px]">
      <div class="mb-8 flex items-center gap-3 md:hidden">
        <app-logo [size]="32" />
        <span class="font-serif text-xl font-bold text-fg">Zen Inventory</span>
      </div>

      <h2 class="mb-2 font-serif text-[28px] leading-tight font-bold tracking-tight text-fg">
        Bienvenido de vuelta
      </h2>
      <p class="mb-8 text-sm text-fg-subtle">Ingresa tus credenciales para continuar</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="flex flex-col gap-[18px]">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }

        <app-form-field label="Correo electrónico" [error]="emailError()">
          <svg data-slot="prefix" lucideMail [size]="15" />
          <input
            appInput
            formControlName="email"
            type="email"
            autocomplete="email"
            placeholder="admin@zeninventory.co"
          />
        </app-form-field>

        <app-form-field label="Contraseña" [error]="passwordError()">
          <svg data-slot="prefix" lucideLock [size]="15" />
          <input
            appInput
            formControlName="password"
            autocomplete="current-password"
            placeholder="••••••••"
            [type]="showPassword() ? 'text' : 'password'"
          />
          <app-password-toggle data-slot="suffix" [(visible)]="showPassword" />
        </app-form-field>

        <button appButton type="submit" size="lg" fullWidth class="mt-1.5" [loading]="submitting()">
          {{ submitting() ? 'Verificando…' : 'Ingresar al sistema' }}
        </button>
      </form>
    </div>
  </section>
</div>
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npm test -- --watch=false && npm run lint && npm run build`
Expected: PASS. Si los mensajes de error no aparecen tras `tab()` o el envío vacío (la plantilla no se vuelve a evaluar con `OnPush` + formularios), exponer el estado del formulario como signal: `private readonly formState = toSignal(this.form.events.pipe(map(() => ({}))), { initialValue: {} })` y leerlo dentro de `emailError()`/`passwordError()` para forzar la dependencia. Registrar el ajuste en el ledger.

- [ ] **Step 6: Mutaciones de comprobación**

(a) Quitar `|| this.submitting()` de `if (this.form.invalid || this.submitting()) return;`: debe fallar "un doble clic envía una sola petición". (b) Cambiar `this.form.enable();` por nada en el `catch`: debe fallar "con credenciales incorrectas … deja reintentar". Restaurar ambas.

- [ ] **Step 7: Commit** — `git add frontend-angular && git commit -m "feat(angular): pantalla de login con formularios reactivos tipados"`

---

### Task 11: Rutas, página "en migración" y verificación de las guardas

**Files:**
- Create: `src/app/features/not-migrated/pages/not-migrated-page.ts`
- Modify: `src/app/app.routes.ts`
- Test: `src/testing/integration/routes.integration.spec.ts`

**Interfaces:**
- Consumes: `guestGuard`, `authGuard`, `roleGuard`, `NAV_SECTIONS`, `Shell`, `LoginPage`.
- Produces: `NotMigratedPage` (`app-not-migrated-page`): `<h1>` con `route.snapshot.data['title']` y el aviso "Esta pantalla todavía no está disponible en la nueva versión.". `routes`: `/login` (`guestGuard`, título "Ingresar | Zen Inventory"); `''` con `authGuard` y `Shell`, que contiene `''` → `dashboard`, una ruta por ítem de `NAV_SECTIONS` (`canActivate: [roleGuard(...roles)]`, título "`<Etiqueta> | Zen Inventory`", `data: { title }`), y `**` → `''`; `**` global → `''`. Al migrar una pantalla se reemplaza su `loadComponent`.

- [ ] **Step 1: Escribir el test de integración (rojo)**

```ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { AuthStore } from '@core/auth/auth-store';
import { routes } from '../../app/app.routes';
import { server, TEST_API } from '../msw-server';

const sessionFor = (rol: string) => ({ token: 't', email: 'e@z.com', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

async function setup(rol?: string) {
  localStorage.clear();
  server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.json({ id: 3, nombre: 'Norte' })));
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
    ],
  });
  if (rol) TestBed.inject(AuthStore).start(sessionFor(rol));
  const harness = await RouterTestingHarness.create();
  return { harness, router: TestBed.inject(Router), store: TestBed.inject(AuthStore) };
}

describe('rutas (guardas + shell + login)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin sesión, una ruta protegida lleva al login', async () => {
    const { harness, router } = await setup();
    await harness.navigateByUrl('/inventory');
    expect(router.url).toBe('/login');
    expect(await screen.findByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
  });

  it('con sesión, "/" lleva al panel dentro del shell', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/');
    expect(router.url).toBe('/dashboard');
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByText(/todavía no está disponible/)).toBeInTheDocument();
  });

  it('el enlace de la pantalla actual queda marcado como página actual', async () => {
    const { harness } = await setup('ADMIN');
    await harness.navigateByUrl('/inventory');
    expect(await screen.findByRole('link', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
  });

  it('con sesión, entrar al login redirige al panel', async () => {
    const { harness, router } = await setup('MANAGER');
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/dashboard');
  });

  it('un rol sin permiso para una ruta vuelve al panel', async () => {
    const { harness, router } = await setup('OPERADOR_INVENTARIO');
    await harness.navigateByUrl('/users');
    expect(router.url).toBe('/dashboard');
  });

  it('un ADMIN accede a un maestro', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/catalog/products');
    expect(router.url).toBe('/catalog/products');
    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument();
  });

  it('un rol desconocido cierra la sesión y termina en el login sin bucle', async () => {
    const { harness, router, store } = await setup('INVENTADO');
    await harness.navigateByUrl('/dashboard');
    expect(router.url).toBe('/login');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('una ruta inexistente con sesión lleva al panel', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/no-existe');
    expect(router.url).toBe('/dashboard');
  });

  it('el sidebar muestra la sucursal del usuario obtenida del backend', async () => {
    const { harness } = await setup('MANAGER');
    await harness.navigateByUrl('/dashboard');
    expect(await screen.findByText('Norte')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla** — FAIL (las rutas están vacías: `/inventory` no existe, etc.).

- [ ] **Step 3: Implementar `not-migrated-page.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Marcador de las pantallas que aún viven solo en el frontend de Next.js. */
@Component({
  selector: 'app-not-migrated-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  template: `
    <h1 class="mb-2 font-serif text-[28px] font-bold tracking-tight text-fg">{{ title }}</h1>
    <p class="text-sm text-fg-subtle">Esta pantalla todavía no está disponible en la nueva versión.</p>
  `,
})
export class NotMigratedPage {
  protected readonly title = String(inject(ActivatedRoute).snapshot.data['title'] ?? '');
}
```

- [ ] **Step 4: Reemplazar `app.routes.ts`**

```ts
import type { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';
import { roleGuard } from '@core/auth/role.guard';
import { NAV_SECTIONS } from './layout/nav-items';

const APP_TITLE = 'Zen Inventory';

const loadNotMigrated = () =>
  import('./features/not-migrated/pages/not-migrated-page').then((m) => m.NotMigratedPage);

/** Una ruta por ítem del menú, con su guarda de roles. Al migrar una pantalla se cambia su `loadComponent`. */
const menuRoutes: Routes = NAV_SECTIONS.flatMap((section) => section.items).map((item) => ({
  path: item.path.replace(/^\//, ''),
  title: `${item.label} | ${APP_TITLE}`,
  data: { title: item.label },
  canActivate: [roleGuard(...item.roles)],
  loadComponent: loadNotMigrated,
}));

export const routes: Routes = [
  {
    path: 'login',
    title: `Ingresar | ${APP_TITLE}`,
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      ...menuRoutes,
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npm test -- --watch=false && npm run lint && npm run build`
Expected: PASS, lint limpio, build OK con chunks perezosos separados para `login-page`, `shell` y `not-migrated-page`. Si un `heading` no se encuentra por el momento de la carga perezosa, esperar con `await harness.fixture.whenStable()` antes de consultar y registrar el ajuste.

- [ ] **Step 6: Mutación de comprobación**

En `app.routes.ts`, quitar `canActivate: [roleGuard(...item.roles)]`: debe fallar "un rol sin permiso para una ruta vuelve al panel". Restaurar.

- [ ] **Step 7: Commit** — `git add frontend-angular && git commit -m "feat(angular): rutas del shell con guardas por rol y página en migración"`

---

### Task 12: E2E del login, documentación y grafo

**Files:**
- Create: `e2e/login.e2e.ts`
- Modify: `README.md` (de `frontend-angular`), `../CLAUDE.md` si hace falta

- [ ] **Step 1: Escribir el E2E (con `/api` interceptado, sin backend)**

```ts
import { expect, test, type Page } from '@playwright/test';

// Estos E2E no necesitan backend: interceptan las llamadas a /api/**.
const adminSession = {
  token: 'jwt-e2e',
  tipo: 'Bearer',
  email: 'ana@zen.com',
  nombre: 'Ana Admin',
  rol: 'ADMIN',
  id: 1,
};

async function stubLogin(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password === 'secreto1') {
      await route.fulfill({ json: adminSession });
    } else {
      await route.fulfill({ status: 401, json: { message: 'Credenciales incorrectas' } });
    }
  });
}

async function login(page: Page, password = 'secreto1') {
  await page.getByLabel('Correo electrónico').fill('ana@zen.com');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
}

test('sin sesión, la raíz lleva al login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeVisible();
});

test('el formulario valida antes de llamar al backend', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByText('El correo es requerido.')).toBeVisible();
  await expect(page.getByText('La contraseña es requerida.')).toBeVisible();
});

test('credenciales incorrectas muestran el mensaje y no entran', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page, 'incorrecta');
  await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas');
  await expect(page).toHaveURL(/\/login$/);
});

test('inicia sesión, conserva la sesión al recargar y cierra sesión', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  await expect(page.getByText('Ana Admin')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Ana Admin')).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/login$/);
});

test('el tema elegido se conserva al recargar', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('el menú del sidebar navega entre pantallas', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('link', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Ejecutar el E2E**

Run: `npx playwright test`
Expected: los tests nuevos y los 2 de humo PASS (8 en total). Si el `title` del E2E de humo cambió por la ruta con título, ajustarlo: el `<title>` de `/` pasa a ser el de la ruta destino; en `e2e/smoke.e2e.ts` `toHaveTitle('Zen Inventory')` debe pasar a `toHaveTitle(/Zen Inventory/)`. Registrar el ajuste en el ledger.

- [ ] **Step 3: Verificación completa**

Run: `npm run build && npm test -- --watch=false && npm run lint && npx playwright test`
Expected: todo en verde.

- [ ] **Step 4: Documentación**

En `README.md` de `frontend-angular`: mencionar en "Estructura" `layout/nav-items.ts` como fuente única del menú y de las rutas, añadir la regla "Una pantalla nueva: agregarla a `NAV_SECTIONS` con sus roles y cambiar su `loadComponent` en `app.routes.ts`", y la nota de que los E2E de login se interceptan sin backend.

- [ ] **Step 5: Regenerar el grafo y commit**

```bash
graphify update ..
git add frontend-angular && git commit -m "test(angular): E2E del login y shell, y documentación de la Etapa 1"
```
Expected: `graphify update` reconstruye sin errores.

---

## Self-Review (hecha al escribir)

- **Cobertura del spec:** §5 componentes reutilizables (`Button`, `FormField`/`InputDirective`, `Alert`, `Spinner`, `Logo`, `PasswordToggle`) nacen porque el login y el shell los usan; `Modal`/`DataTable`/`Select`/`Badge` esperan a la Etapa 2, como dice el spec. §4: rutas lazy con guardas funcionales por rol (Tasks 6, 11), estado con signals, estilos solo con tokens. §6: unit/componentes (Tasks 1–10), integración MSW (Tasks 8, 11) y E2E (Task 12). §2: se evitan sesión suelta, hex sueltos, página gigante, `any`, protección tardía de rutas.
- **Placeholders:** ninguno. Los puntos que dependen de la API real de librerías (`LucideIconData`, `LucideDynamicIcon`, ciclo `InputDirective`↔`FormField`, re-render de `OnPush` en el login, momento de carga perezosa) llevan su comprobación y la alternativa concreta en el paso correspondiente.
- **Consistencia de nombres:** `Role`/`ROLES`/`isRole`, `AuthStore.role`, `DASHBOARD_URL`, `LOGIN_URL`, `NAV_SECTIONS`/`navSectionsFor`, `SidebarState.collapsed/toggle`, `SIDEBAR_STORAGE_KEY`, `THEME_STORAGE_KEY`, `BranchLabelApi.labelFor`, `GLOBAL_LABEL`/`DEFAULT_BRANCH_LABEL`, `FormField.error/label`, `InputDirective`, `PasswordToggle.visible` coinciden entre tareas.
- **Riesgos para el revisor:** (1) paridad de visibilidad del menú con el Next, incluida la de `SELLER` y `MANAGER` (ver Task 7); (2) `GlobalAlertPoller` y el contador de alertas del sidebar quedan para la Etapa 5; (3) `httpResource` no se usa todavía (se estrena con las primeras listas, Etapa 2); (4) el título de las pantallas sin migrar viene del menú.
