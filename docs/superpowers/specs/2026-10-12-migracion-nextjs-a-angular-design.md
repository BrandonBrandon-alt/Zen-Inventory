# Migración incremental del frontend de Next.js a Angular — Diseño

Fecha: 2026-10-12 · Estado: pendiente de revisión

## 1. Objetivo y criterios de éxito

**Objetivo principal:** aprender Angular migrando, poco a poco, el frontend actual
(`frontend/`, Next.js 16 + React 19) a un proyecto Angular nuevo, evitando los
problemas del código actual y aplicando buenas prácticas.

**Pilares explícitos del usuario:**
1. Componentes reutilizables.
2. Buen manejo del CSS.
3. Infraestructura de testing completa.

**Criterios de éxito:**
- Cada etapa deja una pantalla (o conjunto pequeño) funcionando contra el backend real
  (`localhost:8080`), con sus tests. Compilar no basta.
- Antes de escribir cada etapa se explica el concepto de Angular que se usa.
- Ningún problema de la lista de la sección 2 se repite en el código nuevo.
- El resultado final es el Angular completo, limpio y profesional: no una réplica
  literal del Next. Cada error del código actual se corrige al migrar, no se copia.
  Es el criterio de calidad de todas las etapas, por encima de la velocidad.

**Fuera de alcance:** cambios en el backend Spring Boot; SSR; CI/CD (se evalúa después);
NgRx (se evalúa solo si una pantalla lo exige).

## 2. Problemas del Next.js actual que NO se deben repetir

Medidos sobre `frontend/` (2026-10-12):

| Problema | Dato |
|---|---|
| Páginas gigantes | `purchases` 872 líneas, `products` 765, `transfers` 695, `inventory` 664 |
| Estado local desbordado | hasta 24 `useState` en una página |
| `'use client'` casi universal | 63 de 79 `.tsx`: Next/SSR casi no se aprovecha |
| Tipado débil | 228 coincidencias de `any` / `as any` / `@ts-ignore` |
| Colores hardcodeados | 54 hex sueltos en JSX, fuera de tokens |
| Modales dispersos | `Modal`, `ResolutionModal` y al menos un `fixed inset-0` suelto |
| Sesión en `localStorage` | 6 claves sueltas (`zen_inventory_*`) |
| Tests | 0 |

Este cuadro es el checklist de revisión de cada etapa.

## 3. Enfoque: Angular en paralelo, por vertical slices

Carpeta nueva `frontend-angular/` junto a `frontend/`. El Next sigue funcionando como
referencia hasta terminar. Cada etapa migra una pantalla; los componentes compartidos
nacen la primera vez que una segunda pantalla los necesita (no antes).

## 4. Arquitectura base

**Stack:** Angular CLI 22.2 (instalado), Node 24, npm. Standalone components, signals,
control flow `@if`/`@for`, `inject()`, rutas lazy con `loadComponent`. Sin NgModules,
sin SSR. Estilos: CSS + Tailwind 4 (sin SCSS).

**Estructura por features:**
```
src/app/
  core/      servicios singleton: auth, api client, interceptors, guards
  shared/    ui/ (button, modal, data-table, kpi-card…), pipes, directivas
  features/  una carpeta por vertical (users/, branches/, inventory/…)
             cada una: pages/, components/, data-access/ (servicios + tipos)
  layout/    shell: sidebar, header
```
**Regla de dependencias** (forzada con ESLint desde el día uno): `features` importa de
`shared` y `core`, nunca de otra feature; `shared` no importa de `features`.

**Capa de API:** tipos generados desde el OpenAPI del backend con `openapi-typescript`
(como hoy); servicios por feature con `HttpClient` tipado. Un `HttpInterceptor`
funcional inyecta el JWT y ante 401 redirige a login.

**Sesión:** `AuthStore` con signals; una sola clave serializada en `localStorage`
(reemplaza las 6 claves actuales).

**Estado y datos:** signals + servicios por feature. Peticiones con `httpResource` /
`rxResource` para loading/error/datos (reemplaza el patrón `useState` + `useEffect`).

**Estilos:** Tailwind 4 con un `theme.css` central: colores, radios y espaciados como
variables CSS, con modo oscuro. Los 54 hex sueltos pasan a tokens. Las páginas no repiten
clases largas; las encapsulan los componentes de `shared/ui`.

**Ruteo:** `loadComponent` lazy, guards funcionales por rol, resolver solo si hace falta.

## 5. Componentes reutilizables (`shared/ui`)

- Standalone, `input()`/`output()`/`model()`, `ChangeDetectionStrategy.OnPush`.
- API pequeña y tipada (p. ej. `Button` con `variant` y `size` como uniones de strings).
- Contenido proyectado con `ng-content` y slots (`header`, `footer`): un único `Modal`
  base que los modales de feature componen (resuelve `Modal`/`ResolutionModal`).
- Accesibilidad con Angular CDK (`Dialog`, `Overlay`, `A11y`), sin Angular Material.
- `shared/ui` no hace HTTP ni conoce el negocio; los componentes con lógica de dominio
  (`StockStatus`, `TransferCard`…) viven en su feature.
- Un componente sube a `shared/ui` solo al usarlo una segunda pantalla.

## 6. Testing en 3 capas

| Capa | Herramienta | Cubre | Ubicación |
|---|---|---|---|
| Unit y componentes | Runner por defecto de Angular (Vitest; se confirma al crear el proyecto) + Angular Testing Library | Servicios, stores y comportamiento de componentes visto por el usuario (roles, texto) | `*.spec.ts` junto al archivo |
| Integración HTTP | MSW en modo Node | Servicios de `data-access/` contra la API simulada con el contrato real (rutas, query params, payload), interceptor JWT y 401 | `tests/integration/` |
| E2E | Playwright | Flujos reales contra el backend en `localhost:8080`; Playwright solo levanta el frontend | `e2e/` |

- Los handlers MSW se tipan con los tipos generados del OpenAPI: un cambio de contrato
  rompe el test.
- Cada pantalla migrada entra con sus tests o no está terminada. No se escriben tests
  que no puedan fallar por un bug real.
- El E2E solo se corre a pedido (necesita el backend levantado a mano).
- Scripts: `npm test` (unit + integración, sin backend), `npm run test:e2e`, `npm run lint`.

## 7. Etapas (borrador)

0. **Base:** scaffold, Tailwind con tokens, ESLint con regla de dependencias, testing
   (3 capas), generación de tipos OpenAPI, interceptor y `AuthStore`.
1. **Login y shell** (sidebar y layout).
2. **`users` y `branches`:** CRUD simple; nacen `Button`, `Input`, `Modal`,
   `DataTable`, `Select`, `Badge`.
3. **`catalog/*` e `inventory`.**
4. **`dashboard` y `analytics`:** requiere elegir librería de gráficos (Recharts es de React).
5. **Complejas:** `sales/pos`, `purchases`, `transfers`, `returns`, `alerts`, `audit`
   (incluye el polling global de alertas, hoy `GlobalAlertPoller`).

## 8. Riesgos y decisiones abiertas

- Librería de gráficos para la etapa 4 (ng2-charts, ngx-charts u otra): se decide al llegar.
- Duplicación temporal de dos frontends: se mitiga con el orden por etapas.
- `.gitignore` y `Dockerfile`/`docker-compose.yml` de la raíz asumen Next.js; hay que
  actualizarlos cuando Angular reemplace al Next.
- El grafo de graphify describe el Next; regenerarlo (`graphify update .`) al avanzar.
