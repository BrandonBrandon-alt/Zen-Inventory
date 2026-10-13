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
| `npm run test:e2e` | E2E con Playwright. Los flujos de negocio necesitan el backend real levantado. |
| `npm run lint` | ESLint, incluidas las reglas de dependencias entre capas. |
| `npm run build` | Build de producción. |
| `npm run openapi:gen` | Regenera `src/app/core/api/schema.d.ts` desde `localhost:8080/v3/api-docs`. |

> Usa siempre `npm test`, no `ng test` directo: el script `pretest` borra
> `node_modules/.vitest-cache`, porque con Angular 22 + Vitest 5 esa caché puede ejecutar código
> fuente desactualizado y dar falsos verdes.

## Estructura

```
src/app/
  core/      servicios singleton: sesión (AuthStore), AuthApi, interceptor, guard, API_BASE_URL
  shared/    ui/ — componentes reutilizables sin lógica de negocio
  features/  una carpeta por pantalla/vertical (pages/, components/, data-access/)
  layout/    shell de la aplicación
src/testing/ MSW (msw-server.ts), setup de Vitest e integración HTTP
e2e/         tests de Playwright
```

## Reglas

- `features` importa de `core` y `shared`, **nunca de otra feature**; `shared` y `core` no importan de
  `features`. ESLint lo hace cumplir (alias `@core/*`, `@shared/*`, `@features/*`).
- Sin `any` ni `@ts-ignore`.
- Colores y espaciados solo mediante tokens (`src/styles/theme.css`): `bg-base`, `text-fg`, `border-line`…
  Tema oscuro por defecto; el claro se activa con `data-theme="light"` en `<html>`.
- Un componente sube a `shared/ui` solo cuando lo usa una segunda pantalla.
- Cada pantalla migrada entra con sus tests; el E2E se corre a pedido (necesita backend).
- El token JWT solo se envía a la API propia, nunca a otros orígenes.
