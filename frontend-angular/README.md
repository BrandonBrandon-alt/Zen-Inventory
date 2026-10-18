# Zen Inventory — frontend Angular

Único frontend del proyecto: reemplazó al de Next.js, que se retiró (su historia sigue en git). Diseño y plan de la
migración: `../docs/superpowers/specs/` y `../docs/superpowers/plans/`.

## Requisitos

- Node 24 y npm.
- Backend Spring Boot en `localhost:8080` (el puerto se lee de `SPRING_LOCAL_PORT` en `../.env`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en `:4200`; `/api/*` se redirige al backend (`proxy.conf.js`). |
| `npm test` | Unit + integración (Vitest). No necesita backend. |
| `npm run test:e2e` | E2E con Playwright en su propio puerto (4300, no reutiliza el 4200; 2 workers para no saturar el servidor de desarrollo). Los flujos de negocio necesitan el backend real levantado. |
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
con sus roles y cambia su `loadComponent` en `app.routes.ts` (el ítem debe tener su pantalla en `SCREENS`: `app.routes.spec.ts` lo comprueba).

## Reglas

- `features` importa de `core` y `shared`, **nunca de otra feature**; `shared` y `core` no importan de
  `features`. ESLint lo hace cumplir (alias `@core/*`, `@shared/*`, `@features/*`).
- Sin `any` ni `@ts-ignore`.
- Colores y espaciados solo mediante tokens (`src/styles/theme.css`): `bg-base`, `text-fg`, `border-line`…
  Tema oscuro por defecto; el claro se activa con `data-theme="light"` en `<html>`.
- El sidebar se redimensiona arrastrando su borde (200–360 px, también con flechas/Inicio/Fin y doble clic para restablecer); el ancho y el estado colapsado se recuerdan.
- El tema claro/oscuro se cambia desde cualquier pantalla, también el login (`ThemeToggle`, `shared/ui`); se recuerda en el navegador. Al cambiarlo, el tema nuevo se revela como un círculo que crece desde el botón pulsado (View Transitions API; instantáneo si el navegador no la soporta o el usuario pidió menos movimiento).
- Responsivo: desde 768 px el menú es una barra lateral fija; por debajo es un cajón con barra superior (se cierra al elegir una pantalla, al pulsar fuera o con Escape).
- Scroll fino y a tono con el tema en toda la app (`src/styles.css`).
- Tablas: `DataTable` (`shared/ui/data-table`) recibe `columns`, `rows` y `rowKey`; ordena, pagina y gestiona los estados de carga, vacío y error. Las celdas se personalizan con `<ng-template appCell="columna" let-row>`. Ejemplo real: `features/branches/pages/branches-page`.
- Ventanas: `Modal` (`shared/ui/modal`) sobre `<dialog>` nativo (foco, Escape e inerte los gestiona el navegador); `[(open)]`, `dismissible` para bloquear el cierre mientras se guarda. `ConfirmDialog` lo usa para confirmar acciones destructivas.
- Formularios: `applyServerErrors` marca bajo cada campo los `fieldErrors` del backend y `controlError` decide qué mensaje mostrar. Ejemplo: `features/branches/components/branch-form-modal`.
- Sucursales (`/branches`) es solo ADMIN (igual que las acciones del backend): crear, editar y desactivar; la lista se recarga sin parpadeo tras cada acción.
- Usuarios (`/users`): ADMIN gestiona a todos; MANAGER solo a los de su sucursal con rol SELLER u OPERADOR_INVENTARIO (el backend lo exige con 403; la pantalla además oculta las acciones que no corresponden y no muestra el selector de sucursal al MANAGER). `<select appInput>` funciona dentro de `app-form-field` igual que un `<input>`.
- Tipografía: Inter para texto, Lora para detalles de marca (`font-serif`) y **Junicode** para los títulos (`font-title`, paquete `@typopro/web-junicode`, licencia OFL). Para destacar palabras dentro de un título: `<h1>Panel de <span class="italic">control</span></h1>` (cara itálica real de Junicode, sin swashes).
- Selector desplegable: `<app-select>` (`shared/ui/select`) reemplaza al `<select>` nativo. Opciones con icono y descripción, búsqueda interna (`searchable`), teclado completo y panel en la capa superior del navegador (no lo recorta un modal). Funciona con `formControlName`, con `[(value)]` y dentro de `app-form-field`. Ejemplo: `features/users/components/user-form-modal`.
- Botones de acción de fila con icono: `variant="ghost-brand"` (editar, hover en color principal) y `variant="ghost-danger"` (desactivar, hover rojo). Los botones del pie de un modal se separan solos al ir dentro de `<div data-slot="footer">`.
- Inventario (`/inventory`): existencias por sucursal (ADMIN elige sucursal; el resto trabaja en la suya) con búsqueda, nivel crítico/agotado, ajuste manual de stock (ingreso/retiro con motivo y justificación) y stock mínimo; pestaña Kardex con el historial filtrable por producto. Costo y precio solo para ADMIN/MANAGER; el vendedor no ve acciones ni Kardex. Compra, venta y traslado no se ajustan aquí: tienen su propia pantalla.
- `Tabs` (`shared/ui/tabs`) para pestañas accesibles y `shared/format` para pesos, cantidades y fechas.
- Descripciones emergentes: `appTooltip="texto"` (`shared/ui/tooltip`) en botones de solo icono o datos abreviados. Aparece al pasar el cursor (con una breve espera) o al enfocar con el teclado, se oculta con Escape y va en la capa superior del navegador. Un botón de solo icono sigue necesitando su `aria-label`: el tooltip complementa, no sustituye. Ya está en las acciones de Sucursales, Usuarios e Inventario, la paginación y el cierre de los modales.
- Entrada animada de las pantallas (la del Next): `animate-enter` en el encabezado y `animate-enter-delayed` (70 ms después) en el contenido; suben 20 px y aparecen en 0,4 s. Usan `backwards` para no dejar un `transform` al terminar. Con "reducir movimiento" activo se desactivan. Nueva pantalla: encabezado con `animate-enter` y su contenido con `animate-enter-delayed`.
- Un componente sube a `shared/ui` solo cuando lo usa una segunda pantalla.
- Cada pantalla migrada entra con sus tests; el E2E se corre a pedido (necesita backend).
- El token JWT solo se envía a la API propia, nunca a otros orígenes.
- Los E2E de login interceptan `/api/**` (no necesitan backend); los flujos de negocio posteriores sí.

## Docker

El servicio `frontend-angular` del `docker-compose.yml` (raíz del monorepo):

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


## Recursos de las pruebas

`npm test` usa dos procesos de Vitest (ver `vitest-base.config.mts`): ocupa ~2 GB de RAM y deja el equipo usable (sin
límite, usaba todos los núcleos y más de 4 GB). En una máquina holgada se puede subir con `VITEST_MAX_WORKERS=4 npm test`.

## Tamaño del arranque (presupuesto de bundle)

El bundle inicial pesa ~634 kB sin comprimir (~103 kB descargados), por eso el presupuesto de `angular.json` es 650 kB
(aviso) y 800 kB (error), no los 500 kB por defecto. Casi la mitad (~270 kB) es `@lucide/angular`: cada icono viene
como un componente con su plantilla completa repetida (~3 kB por icono, 85 en uso) y el empaquetador no puede
reducirlo. Si el arranque llega a importar, la salida es cambiar a una librería con los datos del icono sueltos
(p. ej. `lucide`) y pintarlos con un único componente: unos 60 archivos, baja a ~390 kB. Para medirlo:
`ng build --source-map` y sumar los bytes generados por paquete a partir del `.map` del chunk grande.

## Factura de venta: datos de la empresa

La factura impresa (80 mm, botón "Imprimir factura" al registrar una venta y en el detalle del historial) toma los
datos de la empresa del backend (`GET /api/v1/company`). Se configuran con variables de entorno del backend, por ejemplo
en el `.env` de la raíz:

```
COMPANY_NAME=Ferretería Zen S.A.S.
COMPANY_TAX_ID=900.123.456-1
COMPANY_ADDRESS=Cra 7 # 12-34, Medellín
COMPANY_PHONE=604 444 0000
COMPANY_INVOICE_PREFIX=FV          # número impreso: FV-000055 (el consecutivo es el id de la venta)
COMPANY_INVOICE_FOOTER=Gracias por su compra
```

Todas son opcionales: lo que quede vacío no se imprime. Es un comprobante interno, no una factura electrónica
(DIAN): para eso hace falta un proveedor tecnológico autorizado.

## Reportes (PDF)

`/reports` (ADMIN y MANAGER): el cierre de caja de un día o el reporte de ventas de un rango, con totales, ventas por
vendedor y productos más vendidos. "Descargar PDF" abre el reporte en formato A4 en el diálogo de impresión del
navegador: ahí se imprime o se elige "Guardar como PDF" (el nombre sugerido es `cierre-de-caja-AAAA-MM-DD`). No usa
ninguna librería de PDF. Las tablas también se pueden bajar en CSV. Se calcula en el navegador con las ventas que el
servidor deja ver a cada rol (el gerente, solo las de su sucursal); una venta anulada no suma a lo vendido.

## Filtros que se recuerdan

Las pantallas con lista (Ventas, Auditoría, Compras, Traslados, Devoluciones, Alertas, Productos, Inventario) recuerdan
sus filtros **por persona y por pantalla** en el navegador (`zen:filters:<usuario>:<pantalla>`): al volver, la lista
sigue como se dejó. El texto de la búsqueda no se guarda. El orden de las tablas también, con `persistKey` en
`app-data-table`.

- `shared/filters/persisted-filter.ts`: `persistedFilter(pantalla, nombre, inicial, codec)` es una señal que se guarda
  sola. Solo guarda lo que difiere del valor inicial y descarta lo guardado que ya no sirve (opción que no existe, tipo
  equivocado, texto alterado). Sin sesión o sin almacenamiento, funciona pero no recuerda.
- `app-advanced-filters`: panel plegable «Más filtros» (el botón cuenta cuántos hay aplicados; el panel recuerda si
  estaba abierto). `app-active-filters`: etiquetas de lo aplicado, que se quitan una a una o todas, para que ningún
  filtro recordado quede activo sin verse.
- `shared/filters/filter-helpers.ts`: rangos de fechas (el «Hasta» incluye el día completo) y de números, opciones de
  selector armadas con los datos y lectura de campos numéricos.
- Para sumar un filtro a una pantalla: una señal `persistedFilter`, su condición en `rows`, su entrada en
  `activeFilters`/`removeFilter`, el campo en la barra o en el panel, y una prueba (los demás filtros sirven de modelo).
