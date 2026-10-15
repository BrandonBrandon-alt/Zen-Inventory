# Zen Inventory — frontend Angular

Migración incremental del frontend de Next.js (`../frontend`) a Angular. Diseño y plan:
`../docs/superpowers/specs/` y `../docs/superpowers/plans/`.

## Requisitos

- Node 24 y npm.
- Backend Spring Boot en `localhost:8080` (el puerto se lee de `SPRING_LOCAL_PORT` en `../.env`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en `:4200`; `/api/*` se redirige al backend (`proxy.conf.js`). |
| `npm test` | Unit + integración (Vitest). No necesita backend. |
| `npm run test:e2e` | E2E con Playwright en su propio puerto (4300, no reutiliza el 4200). Los flujos de negocio necesitan el backend real levantado. |
| `npm run lint` | ESLint, incluidas las reglas de dependencias entre capas. |
| `npm run build` | Build de producción. |
| `npm run openapi:gen` | Regenera `src/app/core/api/schema.d.ts` desde `localhost:8080/v3/api-docs`. |

> Usa siempre `npm test`, no `ng test` directo: el script `pretest` borra
> `node_modules/.vitest-cache`, porque con Angular 22 + Vitest 5 esa caché puede ejecutar código
> fuente desactualizado y dar falsos verdes.

## Estructura

```
src/app/
  core/       servicios únicos de toda la app
    api/        API_BASE_URL y tipos OpenAPI generados
    auth/       session/ (AuthStore), roles/, guards/ (auth, guest, role), http/ (AuthApi, interceptor)
    theme/      ThemeService (claro/oscuro)
  shared/ui/  componentes reutilizables sin lógica de negocio: una carpeta por componente
  layout/     shell de la app: nav-items.ts (menú y rutas), sidebar/, user-card/, shell/
  features/   una carpeta por área de negocio: pages/<pagina>/, components/<componente>/, data-access/
src/testing/ MSW (msw-server.ts), setup de Vitest e integración HTTP (alias @testing/*)
e2e/         tests de Playwright
```

**Un componente = una carpeta** con su `.ts`, su `.html` (si lo tiene) y su `.spec.ts`. Servicios, guardas y
utilidades de un solo archivo quedan planos junto a su spec.

**Menú y rutas:** `layout/nav-items.ts` es la fuente única. Para una pantalla nueva, agrégala a `NAV_SECTIONS`
con sus roles y cambia su `loadComponent` en `app.routes.ts` (mientras tanto muestra `NotMigratedPage`).

## Reglas

- `features` importa de `core` y `shared`, **nunca de otra feature**; `shared` y `core` no importan de
  `features`. ESLint lo hace cumplir (alias `@core/*`, `@shared/*`, `@features/*`).
- Sin `any` ni `@ts-ignore`.
- Colores y espaciados solo mediante tokens (`src/styles/theme.css`): `bg-base`, `text-fg`, `border-line`…
  Tema oscuro por defecto; el claro se activa con `data-theme="light"` en `<html>`.
- El sidebar se redimensiona arrastrando su borde (200–360 px, también con flechas/Inicio/Fin y doble clic para restablecer); el ancho y el estado colapsado se recuerdan.
- El tema claro/oscuro se cambia desde cualquier pantalla, también el login (`ThemeToggle`, `shared/ui`); se recuerda en el navegador.
- Scroll fino y a tono con el tema en toda la app (`src/styles.css`).
- Tablas: `DataTable` (`shared/ui/data-table`) recibe `columns`, `rows` y `rowKey`; ordena, pagina y gestiona los estados de carga, vacío y error. Las celdas se personalizan con `<ng-template appCell="columna" let-row>`. Ejemplo real: `features/branches/pages/branches-page`.
- Un componente sube a `shared/ui` solo cuando lo usa una segunda pantalla.
- Cada pantalla migrada entra con sus tests; el E2E se corre a pedido (necesita backend).
- El token JWT solo se envía a la API propia, nunca a otros orígenes.
- Los E2E de login interceptan `/api/**` (no necesitan backend); los flujos de negocio posteriores sí.

## Docker

El servicio `frontend-angular` del `docker-compose.yml` (raíz del monorepo) convive con el de Next.js:

```bash
docker compose up --build frontend-angular   # levanta también db y backend por depends_on
```

- Se sirve en `http://localhost:4200` (cámbialo con `ANGULAR_PORT` en el `.env` de la raíz).
- La imagen compila la app y la sirve con nginx sin privilegios (`nginx/default.conf.template`): devuelve
  `index.html` en las rutas de la SPA y reenvía `/api/*` al backend (`BACKEND_URL`, por defecto
  `http://backend:8080`), así el navegador usa un único origen y no hace falta CORS.

## Errores de la API

El backend responde todos los errores con el mismo contrato (`ErrorResponse`): `status`, `code` (estable, p. ej.
`INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `INSUFFICIENT_STOCK`), `message` (en español), `path`, `traceId` y, en
validaciones, `fieldErrors`. Un token ausente, inválido o vencido responde **401** (`UNAUTHENTICATED`,
`INVALID_TOKEN`, `TOKEN_EXPIRED`); la falta de permisos, 403 (`ACCESS_DENIED`).

En el frontend:
- `core/api/api-error.ts`: `toApiError()` normaliza cualquier fallo HTTP (también red caída o un 502 del proxy) a un
  `ApiError { status, code, message, fieldErrors, traceId }`. **Decide por `code`, nunca por el texto del mensaje.**
- `core/api/error.interceptor.ts`: avisa globalmente (toast) solo de lo que no es de un formulario: red, servidor
  (5xx), permisos y sesión. Los 400/404/409/422 los maneja la pantalla que hizo la llamada. Si la pantalla ya
  muestra el error (como el login), la petición lleva `SKIP_ERROR_NOTIFICATION`.
- Sesión vencida: `authInterceptor` cierra la sesión y manda al login; el aviso "Tu sesión expiró" sale por el toast.
- `shared/forms/apply-server-errors.ts`: pinta los `fieldErrors` del backend bajo cada campo del formulario.
- `core/notifications/NotificationService` + `layout/toast-container` (en la raíz de la app): avisos globales.
- La lista de códigos vive en dos lados (`ErrorCode.java` y `api-error.ts`): al agregar uno en el backend, súmalo aquí.

