# Angular — Etapa 0: Base del proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `frontend-angular/` creado y listo para migrar pantallas: scaffold, Tailwind 4 con tokens, lint con reglas de dependencias, proxy de desarrollo, tipos OpenAPI, sesión (`AuthStore`), interceptor JWT, guard y las 3 capas de testing funcionando.

**Architecture:** Angular standalone + zoneless + signals, estructura `core/ shared/ features/ layout/`. HTTP con `HttpClient` + interceptor funcional; la sesión vive en un `AuthStore` con signals validado contra un tipo estricto. Tests: Vitest (unit), MSW en Node (integración HTTP), Playwright (E2E).

**Tech Stack:** Angular CLI 22.2, Node 24, npm, Tailwind 4, Vitest (runner por defecto), `@testing-library/angular`, MSW, Playwright, angular-eslint, openapi-typescript.

**Spec:** `docs/superpowers/specs/2026-10-12-migracion-nextjs-a-angular-design.md`

## Global Constraints

- Carpeta del proyecto: `frontend-angular/` en la raíz del monorepo; `frontend/` (Next) NO se toca.
- Standalone components, signals, `inject()`, control flow `@if`/`@for`; sin NgModules; sin SSR; sin SCSS (solo CSS + Tailwind 4).
- `features` importa de `shared` y `core`, nunca de otra feature; `shared` no importa de `features`; `core` no importa de `features`. Lo hace cumplir ESLint.
- Sin `any`, `as any` ni `@ts-ignore`: `@typescript-eslint/no-explicit-any` en `error`.
- Colores solo vía tokens CSS; prohibido hex suelto en plantillas.
- Sesión: UNA sola clave en `localStorage` (`zen_inventory_session`), validada al leerla.
- Backend: Spring Boot en `localhost:8080`, rutas bajo `/api/...`. El backend NO es modificado.
- Tests: no escribir tests que no puedan fallar por un bug real. El E2E solo se corre a pedido.
- Toda salida de comandos se interpreta tal cual; si un resultado esperado no ocurre, detenerse y reportar, no improvisar.

## Review Focus

- `localStorage` inaccesible (modo privado/bloqueado): la app arranca como no autenticada, sin excepción.
- Sesión guardada corrupta o con forma vieja (JSON inválido, campos faltantes): se trata como sin sesión, no rompe el arranque.
- Respuesta de login con campos opcionales ausentes (el OpenAPI los marca todos opcionales): error legible, nunca una sesión a medias.
- 401 del propio login (credenciales malas): muestra el mensaje y NO borra sesión ni redirige en bucle.
- Backend caído / error de red (status 0): mensaje legible, sin tocar la sesión existente.

---

## File Structure

```
frontend-angular/
  proxy.conf.js                      proxy dev /api → backend (puerto desde ../.env)
  playwright.config.ts               E2E
  e2e/smoke.e2e.ts                   humo del E2E
  tests/setup.ts                     arranque de MSW para Vitest
  tests/integration/msw-server.ts    servidor MSW + handlers tipados
  tests/integration/auth-api.integration.spec.ts
  src/styles.css                     entrada: tailwind + fuentes + tema
  src/styles/theme.css               tokens (oscuro por defecto, claro con [data-theme='light'])
  src/app/app.config.ts              providers (router, http + interceptor)
  src/app/app.routes.ts              rutas
  src/app/core/api/api-base-url.ts   InjectionToken API_BASE_URL
  src/app/core/api/schema.d.ts       tipos generados (openapi-typescript)
  src/app/core/auth/auth-session.ts  tipo AuthSession + guard de tipo
  src/app/core/auth/auth-store.ts    estado de sesión (signals)
  src/app/core/auth/auth-api.ts      login contra el backend
  src/app/core/auth/auth.interceptor.ts
  src/app/core/auth/auth.guard.ts
  src/app/shared/ui/.gitkeep         (vacío; se llena desde la Etapa 2)
  src/app/features/.gitkeep
  src/app/layout/.gitkeep
```

Los nombres de archivos generados por `ng new` (p. ej. `src/app/app.ts`, `app.config.ts`, `app.routes.ts`) se confirman en la Tarea 1; si difieren, usar los reales.

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `frontend-angular/**` (generado)
- Modify: `frontend-angular/src/index.html` (título)

- [ ] **Step 1: Generar el proyecto**

Desde la raíz del monorepo (`/home/yep/Documents/optiplant-prueba-tecnica`):

```bash
ng new frontend-angular --style tailwind --routing --ssr=false --zoneless --test-runner vitest --package-manager npm --skip-git --ai-config none --defaults
```
Expected: termina sin error, crea `frontend-angular/` e instala dependencias.

- [ ] **Step 2: Verificar versiones y archivos generados**

```bash
cd frontend-angular && npm ls tailwindcss @angular/core vitest --depth=0 && ls src src/app
```
Expected: `@angular/core` 22.x, `vitest` presente, `tailwindcss` 4.x. Anotar los nombres reales de `src/app/*.ts`.

- [ ] **Step 3: Si Tailwind no es 4.x** (omitir si ya lo es)

```bash
npm i tailwindcss@4 @tailwindcss/postcss@4 postcss
printf '{\n  "plugins": {\n    "@tailwindcss/postcss": {}\n  }\n}\n' > .postcssrc.json
```
Verificar que `src/styles.css` contiene `@import "tailwindcss";` (si no, agregarlo en la primera línea).

- [ ] **Step 4: Estructura de carpetas y título**

```bash
mkdir -p src/app/core/api src/app/core/auth src/app/shared/ui src/app/features src/app/layout
touch src/app/shared/ui/.gitkeep src/app/features/.gitkeep src/app/layout/.gitkeep
```
En `src/index.html` dejar `<title>Zen Inventory</title>`.

- [ ] **Step 5: Plantilla raíz mínima**

Reemplazar el contenido de la plantilla del componente raíz (el `.html` o el `template` inline del componente en `src/app/app.ts`) por exactamente:

```html
<router-outlet />
```
Asegurar que el componente importa `RouterOutlet`.

- [ ] **Step 6: Verificar que compila y que el test de humo generado pasa**

```bash
npm run build && npm test -- --watch=false
```
Expected: build OK; los tests generados pasan. Si el test generado del componente raíz comprueba contenido de la plantilla de bienvenida y falla, reemplazarlo por un test que verifique que el componente se crea (`expect(fixture.componentInstance).toBeTruthy()`).

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): scaffold de frontend-angular (zoneless, vitest, tailwind)"
```

---

### Task 2: Tokens de diseño y Tailwind

**Files:**
- Create: `frontend-angular/src/styles/theme.css`
- Modify: `frontend-angular/src/styles.css`

**Interfaces:**
- Produces: clases utilitarias Tailwind `bg-base`, `bg-surface`, `bg-card`, `bg-hover`, `text-fg`, `text-fg-muted`, `border-line`, `bg-brand`, `text-danger`, `text-success`, `text-warning`, `text-info`, `rounded-sm/md/lg/xl`, `font-sans`, `font-serif`; atributo `data-theme="light"` en `<html>` activa el tema claro.

- [ ] **Step 1: Instalar fuentes locales**

```bash
cd frontend-angular && npm i @fontsource-variable/inter @fontsource/lora
```

- [ ] **Step 2: Crear `src/styles/theme.css`**

Solo los tokens del sistema Zen (se descartan los tokens duplicados de shadcn del Next: un único sistema de diseño).

```css
/* Tokens de diseño — Zen Inventory. Oscuro por defecto, claro con [data-theme='light']. */
:root {
  --bg-base: #242421;
  --bg-surface: #1f1f1c;
  --bg-card: #2a2a26;
  --bg-hover: #32322d;

  --brand-400: #e87c6a;
  --brand-500: #d9634f;
  --brand-600: #c0503c;
  --brand-glow: rgba(217, 99, 79, 0.22);

  --btn-primary-bg: #d1cfc0;
  --btn-primary-text: #1f1f1f;
  --btn-primary-hover-bg: #f5f4f0;

  --neutral-50: #f2f0e3;
  --neutral-100: #f2f0e3;
  --neutral-200: #cbc8bf;
  --neutral-300: #a8a49a;
  --neutral-400: #7c7971;
  --neutral-500: #5a574f;
  --neutral-600: #3d3b35;
  --neutral-700: #2e2c27;
  --neutral-800: #232220;
  --neutral-900: #191917;

  --border-default: rgba(255, 255, 255, 0.07);
  --border-subtle: rgba(255, 255, 255, 0.04);

  --state-danger: #e07070;
  --state-success: #6fbf8a;
  --state-warning: #f59e0b;
  --state-info: #60a5fa;

  --page-padding: 40px;
}

:root[data-theme='light'] {
  --bg-base: #f2f0e3;
  --bg-surface: #eeebe4;
  --bg-card: #f2f0e3;
  --bg-hover: #e8e4db;

  --brand-400: #c94f3a;
  --brand-500: #b83c28;
  --brand-600: #9e2f1e;
  --brand-glow: rgba(185, 60, 40, 0.18);

  --btn-primary-bg: #2e2e2e;
  --btn-primary-text: #f5f4f0;
  --btn-primary-hover-bg: #2c2a25;

  --neutral-50: #1a1917;
  --neutral-100: #2c2a25;
  --neutral-200: #3d3b35;
  --neutral-300: #5a574f;
  --neutral-400: #7c7971;
  --neutral-500: #a8a49a;
  --neutral-600: #cbc8bf;
  --neutral-700: #dedbd3;
  --neutral-800: #eceae3;
  --neutral-900: #f5f3ee;

  --border-default: rgba(0, 0, 0, 0.1);
  --border-subtle: rgba(0, 0, 0, 0.06);

  --state-danger: #cc4444;
  --state-success: #2d8a52;
  --state-warning: #c07c00;
  --state-info: #1d72d4;
}

@media (max-width: 1024px) {
  :root { --page-padding: 24px; }
}
@media (max-width: 768px) {
  :root { --page-padding: 16px; }
}

/* Expone los tokens como utilidades de Tailwind (bg-base, text-fg, border-line…). */
@theme inline {
  --color-base: var(--bg-base);
  --color-surface: var(--bg-surface);
  --color-card: var(--bg-card);
  --color-hover: var(--bg-hover);
  --color-fg: var(--neutral-100);
  --color-fg-muted: var(--neutral-300);
  --color-fg-subtle: var(--neutral-400);
  --color-line: var(--border-default);
  --color-line-subtle: var(--border-subtle);
  --color-brand: var(--brand-500);
  --color-brand-soft: var(--brand-400);
  --color-brand-strong: var(--brand-600);
  --color-primary: var(--btn-primary-bg);
  --color-primary-fg: var(--btn-primary-text);
  --color-danger: var(--state-danger);
  --color-success: var(--state-success);
  --color-warning: var(--state-warning);
  --color-info: var(--state-info);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --font-sans: 'Inter Variable', system-ui, -apple-system, sans-serif;
  --font-serif: 'Lora', Georgia, serif;
}
```

- [ ] **Step 3: Reemplazar `src/styles.css`**

```css
@import 'tailwindcss';
@import '@fontsource-variable/inter';
@import '@fontsource/lora/400.css';
@import '@fontsource/lora/600.css';
@import './styles/theme.css';

@layer base {
  body {
    min-height: 100vh;
    background: var(--bg-base);
    color: var(--neutral-100);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    transition: background 0.25s ease, color 0.25s ease;
  }
}
```

- [ ] **Step 4: Verificar que compila y que las utilidades existen**

```bash
npm run build
grep -o "\.bg-base\|\.text-fg\|\.border-line" dist/*/browser/styles*.css | sort -u
```
Expected: build OK. El `grep` solo muestra clases si hay uso; para forzar la comprobación añadir temporalmente `<p class="bg-base text-fg border border-line">x</p>` a la plantilla raíz, volver a compilar, ver las tres clases en el CSS y **revertir la plantilla a `<router-outlet />`**.

- [ ] **Step 5: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): tokens de diseño y tema oscuro/claro con Tailwind 4"
```

---

### Task 3: Lint y reglas de dependencias

**Files:**
- Modify: `frontend-angular/eslint.config.js` (generado por angular-eslint)
- Modify: `frontend-angular/tsconfig.json`
- Create (temporales, se eliminan): archivos de prueba de violación

**Interfaces:**
- Produces: alias de TypeScript `@core/*`, `@shared/*`, `@features/*`; script `npm run lint`.

- [ ] **Step 1: Instalar angular-eslint**

```bash
cd frontend-angular && ng add angular-eslint --skip-confirmation
```
Expected: crea `eslint.config.js` y agrega el script `lint`.

- [ ] **Step 2: Alias de rutas en `tsconfig.json`**

Dentro de `compilerOptions` agregar:

```json
"baseUrl": "./",
"paths": {
  "@core/*": ["src/app/core/*"],
  "@shared/*": ["src/app/shared/*"],
  "@features/*": ["src/app/features/*"]
}
```

- [ ] **Step 3: Escribir el test de violación (debe fallar el lint)**

```bash
mkdir -p src/app/features/alpha src/app/features/beta
printf "export const alpha = 1;\n" > src/app/features/alpha/alpha.ts
printf "import { alpha } from '../alpha/alpha';\nexport const beta = alpha;\n" > src/app/features/beta/beta.ts
printf "import { alpha } from '@features/alpha/alpha';\nexport const gamma = alpha;\n" > src/app/shared/ui/leak.ts
```

- [ ] **Step 4: Añadir las reglas a `eslint.config.js`**

Agregar al final del array exportado (respetando la sintaxis del archivo generado) estos bloques:

```js
{
  files: ['src/**/*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
  },
},
{
  files: ['src/app/features/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@features/*'], message: 'Una feature no puede importar de otra feature.' },
        { group: ['../../*'], message: 'Imports relativos que salen de la feature están prohibidos; usa @core o @shared.' },
      ],
    }],
  },
},
{
  files: ['src/app/shared/**/*.ts', 'src/app/core/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@features/*', '**/features/**'], message: 'shared y core no pueden depender de features.' },
      ],
    }],
  },
},
```

- [ ] **Step 5: Verificar que el lint falla por las razones correctas**

```bash
npm run lint
```
Expected: FAIL con 2 errores `no-restricted-imports` (uno en `features/beta/beta.ts`, otro en `shared/ui/leak.ts`) y ninguno más.

- [ ] **Step 6: Eliminar los archivos de prueba y verificar que pasa**

```bash
rm -r src/app/features/alpha src/app/features/beta src/app/shared/ui/leak.ts
npm run lint
```
Expected: PASS sin errores.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "chore(angular): eslint con reglas de dependencias y prohibición de any"
```

---

### Task 4: Proxy de desarrollo y URL base de la API

**Files:**
- Create: `frontend-angular/proxy.conf.js`, `frontend-angular/src/app/core/api/api-base-url.ts`
- Modify: `frontend-angular/package.json` (script `start`)

**Interfaces:**
- Produces: `API_BASE_URL: InjectionToken<string>` (valor por defecto `''`, es decir mismo origen); en dev `/api` se redirige al backend.

- [ ] **Step 1: Crear `proxy.conf.js`**

El puerto se lee de `SPRING_LOCAL_PORT` en el `.env` raíz (Node 24: `process.loadEnvFile`).

```js
const path = require('node:path');

try {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
} catch {
  // Sin .env: se usa el puerto por defecto.
}

const port = process.env['SPRING_LOCAL_PORT'] || '8080';

module.exports = {
  '/api': {
    target: `http://localhost:${port}`,
    secure: false,
    changeOrigin: true,
  },
};
```

- [ ] **Step 2: Apuntar `ng serve` al proxy**

En `package.json`, script `start`: `"start": "ng serve --proxy-config proxy.conf.js"`.

- [ ] **Step 3: Crear `api-base-url.ts`**

```ts
import { InjectionToken } from '@angular/core';

/**
 * Prefijo de todas las rutas del backend. Vacío = mismo origen: en desarrollo lo
 * resuelve el proxy (proxy.conf.js) y en producción el servidor web (nginx).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});
```

- [ ] **Step 4: Verificar el arranque con proxy**

```bash
cd frontend-angular && (timeout 25 npm start 2>&1 | tail -8)
```
Expected: el log muestra `Local: http://localhost:4200/` sin errores de configuración del proxy (el `timeout` corta el servidor; código 124 es normal).

- [ ] **Step 5: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): proxy de desarrollo y token API_BASE_URL"
```

---

### Task 5: Tipos OpenAPI

**Files:**
- Create: `frontend-angular/src/app/core/api/schema.d.ts`
- Modify: `frontend-angular/package.json`

**Interfaces:**
- Produces: `paths`, `components` (de `openapi-typescript`) importables como `import type { components } from '@core/api/schema'`; script `npm run openapi:gen`.

- [ ] **Step 1: Instalar el generador y añadir el script**

```bash
cd frontend-angular && npm i -D openapi-typescript
npm pkg set scripts.openapi:gen="openapi-typescript http://localhost:8080/v3/api-docs -o ./src/app/core/api/schema.d.ts"
```

- [ ] **Step 2: Obtener el esquema**

Si el backend está levantado en `localhost:8080`: `npm run openapi:gen`. Si no lo está (estado actual), sembrar con el esquema ya generado del Next:

```bash
cp ../frontend/src/api/schema.d.ts src/app/core/api/schema.d.ts
```
Verificar: `grep -c "LoginResponse" src/app/core/api/schema.d.ts` → `>= 1`.

- [ ] **Step 3: Excluir el archivo generado del lint**

En `eslint.config.js` agregar al inicio del array `{ ignores: ['src/app/core/api/schema.d.ts'] }`. Ejecutar `npm run lint` → PASS.

- [ ] **Step 4: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): tipos OpenAPI y script openapi:gen"
```

---

### Task 6: Sesión — `AuthSession` y `AuthStore` (TDD)

**Files:**
- Create: `src/app/core/auth/auth-session.ts`, `src/app/core/auth/auth-store.ts`
- Test: `src/app/core/auth/auth-store.spec.ts`

**Interfaces:**
- Produces:
  - `interface AuthSession { token: string; email: string; nombre: string; rol: string; id: number; sucursalId?: number }`
  - `function isAuthSession(value: unknown): value is AuthSession`
  - `AuthStore` (`providedIn: 'root'`): `session: Signal<AuthSession | null>`, `isAuthenticated: Signal<boolean>`, `token: Signal<string | null>`, `start(session: AuthSession): void`, `clear(): void`. Constante exportada `SESSION_STORAGE_KEY = 'zen_inventory_session'`.

- [ ] **Step 1: Escribir los tests que fallan**

`src/app/core/auth/auth-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, SESSION_STORAGE_KEY } from './auth-store';
import type { AuthSession } from './auth-session';

const session: AuthSession = {
  token: 'jwt-123',
  email: 'ana@zen.com',
  nombre: 'Ana',
  rol: 'ADMIN',
  id: 7,
  sucursalId: 3,
};

function createStore(): AuthStore {
  TestBed.resetTestingModule();
  return TestBed.inject(AuthStore);
}

describe('AuthStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('arranca sin sesión cuando no hay nada guardado', () => {
    const store = createStore();
    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
  });

  it('start() expone la sesión y la persiste en una sola clave', () => {
    const store = createStore();
    store.start(session);
    expect(store.session()).toEqual(session);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.token()).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null')).toEqual(session);
  });

  it('restaura una sesión válida guardada', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(createStore().session()).toEqual(session);
  });

  it('clear() borra la sesión del estado y del almacenamiento', () => {
    const store = createStore();
    store.start(session);
    store.clear();
    expect(store.session()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignora JSON corrupto sin lanzar', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{no-es-json');
    expect(createStore().session()).toBeNull();
  });

  it.each([
    ['sin token', { ...session, token: undefined }],
    ['id no numérico', { ...session, id: '7' }],
    ['rol vacío de tipo incorrecto', { ...session, rol: 5 }],
  ])('descarta una sesión guardada con forma inválida (%s)', (_name, bad) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(bad));
    expect(createStore().session()).toBeNull();
  });

  it('arranca sin sesión si localStorage lanza (modo privado/bloqueado)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(createStore().session()).toBeNull();
  });

  it('start() mantiene la sesión en memoria aunque no pueda persistir', () => {
    const store = createStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => store.start(session)).not.toThrow();
    expect(store.isAuthenticated()).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd frontend-angular && npm test -- --watch=false --include "src/app/core/auth/auth-store.spec.ts"
```
Expected: FAIL (módulos `./auth-store` y `./auth-session` no existen).

- [ ] **Step 3: Implementar `auth-session.ts`**

```ts
/** Sesión autenticada. A diferencia del OpenAPI (todo opcional), aquí todo es obligatorio salvo sucursalId. */
export interface AuthSession {
  token: string;
  email: string;
  nombre: string;
  rol: string;
  id: number;
  sucursalId?: number;
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['token'] === 'string' &&
    v['token'].length > 0 &&
    typeof v['email'] === 'string' &&
    typeof v['nombre'] === 'string' &&
    typeof v['rol'] === 'string' &&
    typeof v['id'] === 'number' &&
    (v['sucursalId'] === undefined || typeof v['sucursalId'] === 'number')
  );
}
```

- [ ] **Step 4: Implementar `auth-store.ts`**

```ts
import { Injectable, computed, signal } from '@angular/core';
import { type AuthSession, isAuthSession } from './auth-session';

export const SESSION_STORAGE_KEY = 'zen_inventory_session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null): void {
  try {
    if (session === null) localStorage.removeItem(SESSION_STORAGE_KEY);
    else localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Almacenamiento no disponible: la sesión sigue viva solo en memoria.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly state = signal<AuthSession | null>(readStoredSession());

  readonly session = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly token = computed(() => this.state()?.token ?? null);

  start(session: AuthSession): void {
    this.state.set(session);
    writeStoredSession(session);
  }

  clear(): void {
    this.state.set(null);
    writeStoredSession(null);
  }
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

```bash
npm test -- --watch=false --include "src/app/core/auth/auth-store.spec.ts" && npm run lint
```
Expected: todos los tests PASS; lint sin errores. (Si `--include` no es aceptado por el builder, ejecutar `npm test -- --watch=false` completo.)

- [ ] **Step 6: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): AuthStore con sesión validada y persistencia tolerante a fallos"
```

---

### Task 7: Interceptor JWT y guard (TDD)

**Files:**
- Create: `src/app/core/auth/auth.interceptor.ts`, `src/app/core/auth/auth.guard.ts`
- Test: `src/app/core/auth/auth.interceptor.spec.ts`, `src/app/core/auth/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `AuthStore` (`token()`, `clear()`, `isAuthenticated()`), `API_BASE_URL`.
- Produces: `authInterceptor: HttpInterceptorFn`; `authGuard: CanActivateFn` (redirige a `/login` con `UrlTree`); constante `LOGIN_URL = '/login'`, definida y exportada en `auth.interceptor.ts` e importada por el guard.

- [ ] **Step 1: Escribir los tests del interceptor**

`src/app/core/auth/auth.interceptor.spec.ts`:

```ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth-store';

const session = { token: 'jwt-123', email: 'a@z.com', nombre: 'A', rol: 'ADMIN', id: 1 };

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let store: AuthStore;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  it('añade Authorization: Bearer cuando hay sesión', () => {
    store.start(session);
    http.get('/api/branches').subscribe();
    const req = controller.expectOne('/api/branches');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush([]);
  });

  it('no añade Authorization sin sesión', () => {
    http.get('/api/branches').subscribe();
    const req = controller.expectOne('/api/branches');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('no envía el token al endpoint de login', () => {
    store.start(session);
    http.post('/api/auth/login', {}).subscribe();
    const req = controller.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('ante 401 con sesión: limpia la sesión, redirige a /login y propaga el error', () => {
    store.start(session);
    let status = 0;
    http.get('/api/branches').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/branches').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(store.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('401 del propio login (credenciales malas): no limpia ni redirige, propaga el error', () => {
    store.start(session);
    let status = 0;
    http.post('/api/auth/login', {}).subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(store.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('error de red (status 0): propaga el error sin tocar la sesión', () => {
    store.start(session);
    let status = -1;
    http.get('/api/branches').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/branches').error(new ProgressEvent('error'));
    expect(status).toBe(0);
    expect(store.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Escribir los tests del guard**

`src/app/core/auth/auth.guard.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth-store';

const run = () =>
  TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    // Doble mínimo: devuelve los comandos para poder afirmar el destino sin armar rutas reales.
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
  });

  it('permite el paso con sesión', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'r', id: 1 });
    expect(run()).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    expect(run()).toEqual(['/login']);
  });
});
```

El guard solo debe llamar `router.createUrlTree(['/login'])`. Alternativa con el `Router` real: `provideRouter([])` y comparar `router.serializeUrl(result)` con `'/login'`.

- [ ] **Step 3: Ejecutar y comprobar que fallan**

```bash
cd frontend-angular && npm test -- --watch=false --include "src/app/core/auth/auth.*.spec.ts"
```
Expected: FAIL (no existen `auth.interceptor` ni `auth.guard`).

- [ ] **Step 4: Implementar `auth.interceptor.ts`**

```ts
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth-store';

export const LOGIN_URL = '/login';
const LOGIN_ENDPOINT = '/api/auth/login';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const isLoginCall = req.url.endsWith(LOGIN_ENDPOINT);
  const token = store.token();
  const outgoing =
    token && !isLoginCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginCall && store.isAuthenticated()) {
        store.clear();
        void router.navigateByUrl(LOGIN_URL);
      }
      return throwError(() => error);
    }),
  );
};
```

- [ ] **Step 5: Implementar `auth.guard.ts`**

```ts
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { LOGIN_URL } from './auth.interceptor';
import { AuthStore } from './auth-store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  return store.isAuthenticated() ? true : inject(Router).createUrlTree([LOGIN_URL]);
};
```

- [ ] **Step 6: Ejecutar y comprobar que pasan**

```bash
npm test -- --watch=false --include "src/app/core/auth/auth.*.spec.ts" && npm run lint
```
Expected: PASS y lint limpio. El caso 401-con-sesión confirma que `navigate` se llama exactamente una vez.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): interceptor JWT con manejo de 401 y authGuard"
```

---

### Task 8: `AuthApi` y MSW (integración HTTP, TDD)

**Files:**
- Create: `tests/setup.ts`, `tests/integration/msw-server.ts`, `src/app/core/auth/auth-api.ts`
- Test: `tests/integration/auth-api.integration.spec.ts`
- Modify: `frontend-angular/angular.json` (opciones del target `test`), `package.json`

**Interfaces:**
- Consumes: `API_BASE_URL`, `AuthStore.start`, tipos `components['schemas']['LoginRequest' | 'LoginResponse']`.
- Produces: `AuthApi.login(credentials: { email: string; password: string }): Promise<AuthSession>` — en éxito guarda la sesión en `AuthStore` y la devuelve; en fallo lanza `AuthError` (clase exportada, `message` legible, propiedad `kind: 'credentials' | 'network' | 'invalid-response'`).

- [ ] **Step 1: Instalar dependencias de test**

```bash
cd frontend-angular && npm i -D msw jsdom @testing-library/angular @testing-library/dom @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Servidor MSW con handlers tipados**

`tests/integration/msw-server.ts`:

```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { components } from '../../src/app/core/api/schema';

export const TEST_API = 'http://api.test';

type LoginResponse = components['schemas']['LoginResponse'];

export const okLogin: LoginResponse = {
  token: 'jwt-123',
  tipo: 'Bearer',
  email: 'ana@zen.com',
  nombre: 'Ana',
  rol: 'ADMIN',
  id: 7,
  sucursalId: 3,
};

export const server = setupServer(
  http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.json(okLogin)),
);
```

- [ ] **Step 3: Arranque de MSW para Vitest**

`tests/setup.ts`:

```ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './integration/msw-server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 4: Configurar el target `test` en `angular.json`**

En `projects.frontend-angular.architect.test.options` (si el builder rechaza alguna clave, consultar `ng test --help`):

```json
"include": ["src/**/*.spec.ts", "tests/integration/**/*.spec.ts"],
"setupFiles": ["tests/setup.ts"]
```

- [ ] **Step 5: Escribir los tests de integración (fallan)**

`tests/integration/auth-api.integration.spec.ts`:

```ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../src/app/core/api/api-base-url';
import { AuthApi, AuthError } from '../../src/app/core/auth/auth-api';
import { authInterceptor } from '../../src/app/core/auth/auth.interceptor';
import { AuthStore } from '../../src/app/core/auth/auth-store';
import { okLogin, server, TEST_API } from './msw-server';

const credentials = { email: 'ana@zen.com', password: 'secreto' };

describe('AuthApi (contrato HTTP real con MSW)', () => {
  let api: AuthApi;
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
        { provide: API_BASE_URL, useValue: TEST_API },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      ],
    });
    api = TestBed.inject(AuthApi);
    store = TestBed.inject(AuthStore);
  });

  it('envía email y password por POST y guarda la sesión', async () => {
    let received: unknown;
    server.use(
      http.post(`${TEST_API}/api/auth/login`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(okLogin);
      }),
    );
    const session = await api.login(credentials);
    expect(received).toEqual(credentials);
    expect(session).toEqual({ token: 'jwt-123', email: 'ana@zen.com', nombre: 'Ana', rol: 'ADMIN', id: 7, sucursalId: 3 });
    expect(store.session()).toEqual(session);
  });

  it('credenciales incorrectas (401): AuthError "credentials" con el mensaje del backend y sin sesión', async () => {
    server.use(
      http.post(`${TEST_API}/api/auth/login`, () =>
        HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 }),
      ),
    );
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('401 sin cuerpo: mensaje genérico legible', async () => {
    server.use(http.post(`${TEST_API}/api/auth/login`, () => new HttpResponse(null, { status: 401 })));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas. Inténtalo de nuevo.' });
  });

  it('respuesta sin token (campos opcionales ausentes): AuthError "invalid-response", sin sesión parcial', async () => {
    server.use(http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.json({ email: 'ana@zen.com' })));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'invalid-response' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('backend caído / error de red: AuthError "network" y la sesión previa no se toca', async () => {
    store.start({ token: 'old', email: 'x@z.com', nombre: 'X', rol: 'USER', id: 1 });
    server.use(http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.error()));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'network', message: 'No se pudo conectar con el servidor.' });
    expect(store.token()).toBe('old');
  });
});
```

- [ ] **Step 6: Ejecutar y comprobar que fallan**

```bash
npm test -- --watch=false
```
Expected: FAIL por `auth-api` inexistente (los demás tests siguen en verde).

- [ ] **Step 7: Implementar `auth-api.ts`**

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { components } from '@core/api/schema';
import { API_BASE_URL } from '@core/api/api-base-url';
import { type AuthSession, isAuthSession } from './auth-session';
import { AuthStore } from './auth-store';

type LoginRequest = components['schemas']['LoginRequest'];
type LoginResponse = components['schemas']['LoginResponse'];

export type AuthErrorKind = 'credentials' | 'network' | 'invalid-response';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const DEFAULT_CREDENTIALS_MESSAGE = 'Credenciales incorrectas. Inténtalo de nuevo.';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly store = inject(AuthStore);

  async login(credentials: LoginRequest): Promise<AuthSession> {
    let response: LoginResponse;
    try {
      response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.baseUrl}/api/auth/login`, credentials),
      );
    } catch (error) {
      throw this.toAuthError(error);
    }

    const session = {
      token: response.token,
      email: response.email,
      nombre: response.nombre ?? '',
      rol: response.rol ?? '',
      id: response.id,
      sucursalId: response.sucursalId,
    };
    if (!isAuthSession(session)) {
      throw new AuthError('invalid-response', 'El servidor devolvió una respuesta de sesión incompleta.');
    }
    this.store.start(session);
    return session;
  }

  private toAuthError(error: unknown): AuthError {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return new AuthError('network', 'No se pudo conectar con el servidor.');
      const body: unknown = error.error;
      const message =
        typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : DEFAULT_CREDENTIALS_MESSAGE;
      return new AuthError('credentials', message);
    }
    return new AuthError('network', 'No se pudo conectar con el servidor.');
  }
}
```

Nota: `isAuthSession` exige `sucursalId` ausente o numérico; si `response.sucursalId` es `undefined` el objeto lo trae como `undefined` y sigue siendo válido.

- [ ] **Step 8: Ejecutar toda la suite y el lint**

```bash
npm test -- --watch=false && npm run lint
```
Expected: PASS en unit + integración; `onUnhandledRequest: 'error'` no dispara en ningún test.

- [ ] **Step 9: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): AuthApi con validación estricta y tests de integración con MSW"
```

---

### Task 9: Cableado de la app (providers, rutas) y E2E de humo

**Files:**
- Modify: `src/app/app.config.ts`, `src/app/app.routes.ts`
- Create: `playwright.config.ts`, `e2e/smoke.e2e.ts`
- Modify: `package.json` (scripts), `.gitignore` del proyecto

- [ ] **Step 1: Providers en `app.config.ts`**

Dejar los providers generados y asegurar que incluyen (importando lo necesario):

```ts
provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
```
Mantener `provideBrowserGlobalErrorListeners()`, `provideZonelessChangeDetection()` (si el CLI ya los generó) y `provideRouter(routes)`.

- [ ] **Step 2: Rutas**

`app.routes.ts` queda con el arreglo vacío tipado hasta la Etapa 1 (login):

```ts
import type { Routes } from '@angular/router';

export const routes: Routes = [];
```

- [ ] **Step 3: Instalar Playwright y scripts**

```bash
cd frontend-angular && npm i -D @playwright/test && npx playwright install chromium
npm pkg set scripts.test:e2e="playwright test"
printf '\n/test-results\n/playwright-report\n' >> .gitignore
```

- [ ] **Step 4: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

// Requiere el backend real en localhost:8080: Playwright solo levanta el frontend.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry' },
  webServer: { command: 'npm start', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 5: `e2e/smoke.e2e.ts`**

```ts
import { expect, test } from '@playwright/test';

test('la app arranca y tiene el título del producto', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Zen Inventory');
});
```

- [ ] **Step 6: Verificación (este E2E de humo no necesita backend; los de flujos sí y van a pedido)**

```bash
npm run build && npm test -- --watch=false && npm run lint && npm run test:e2e
```
Expected: build OK, unit+integración PASS, lint limpio, 1 test E2E PASS.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend-angular && git commit -m "feat(angular): providers HTTP, rutas base y E2E de humo con Playwright"
```

---

### Task 10: Documentación y grafo

**Files:**
- Modify: `CLAUDE.md` (raíz), crear `frontend-angular/README.md`

- [ ] **Step 1: README del proyecto**

`frontend-angular/README.md` con: requisitos (Node 24, backend en 8080), comandos (`npm start`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run openapi:gen`), estructura `core/shared/features/layout`, reglas de dependencias y de tokens de diseño. Máximo 60 líneas.

- [ ] **Step 2: Sección de testing y convenciones en `CLAUDE.md` raíz**

Agregar una sección "frontend-angular" con: las 3 capas y sus comandos, la regla "cada pantalla migrada entra con sus tests", y "el E2E solo a pedido (necesita backend)".

- [ ] **Step 3: Regenerar el grafo**

```bash
graphify update .
```
Expected: reconstrucción sin errores; `frontend-angular` aparece en el grafo.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md frontend-angular/README.md && git commit -m "docs: README de frontend-angular y convenciones de testing"
```

---

## Self-Review (hecha al escribir)

- **Cobertura del spec §4–§6 para la Etapa 0:** scaffold (T1), Tailwind + tokens + dark/light (T2), ESLint con regla de dependencias y sin `any` (T3), capa de API con proxy y tipos (T4, T5), sesión en una clave con signals (T6), interceptor JWT/401 (T7), AuthApi + MSW tipado (T8), Playwright (T9), docs (T10). La regla "cada pantalla con sus tests" se documenta en T10.
- **Fuera de esta etapa (siguientes planes):** login UI + shell (Etapa 1), `shared/ui` (Etapa 2 en adelante), `roleGuard` (se define cuando haya roles reales en pantallas), `httpResource` (primera pantalla con listados), gráficos (Etapa 4).
- **Consistencia de nombres:** `AuthSession`, `isAuthSession`, `AuthStore.{session,isAuthenticated,token,start,clear}`, `SESSION_STORAGE_KEY`, `API_BASE_URL`, `AuthApi.login`, `AuthError.kind`, `LOGIN_URL` coinciden entre tareas.
- **Riesgos conocidos de verificar al ejecutar (no son pendientes de diseño):** nombres de opciones del target `test` en `angular.json` (`include`, `setupFiles`) según el builder de Angular 22; nombres exactos de archivos generados por `ng new`; versión de Tailwind que instala `--style tailwind`.
