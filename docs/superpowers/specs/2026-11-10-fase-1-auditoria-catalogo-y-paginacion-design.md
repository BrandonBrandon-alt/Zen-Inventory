# Fase 1 — Auditoría del catálogo y paginación en el servidor

Fecha: 2026-11-10 · Estado: aprobado en conversación, pendiente de revisión escrita.
Fases siguientes (fuera de esta spec): 2 órdenes sugeridas + cuentas por pagar · 3 toma de inventario + lotes ·
4 clientes · 5 correo (recuperar contraseña + avisos).

## 1. Objetivo y criterios de éxito

Cerrar dos límites que la aplicación declara hoy en `docs/REQUISITOS.md`:

1. **Nadie sabe quién cambió un precio, un costo, un mínimo o el rol de un usuario.** Se registran esos cambios y el
   ADMIN los consulta en Auditoría Global.
2. **Kardex, compras y traslados descargan todas sus filas.** Con los datos de demostración, el kardex de un ADMIN baja
   12,5 MB, compras 2 MB y traslados 0,8 MB en cada carga. Pasan a pedir solo la página que se ve.

Éxito:

- Cambiar el precio de un producto deja una fila «Precio de venta: $ 34.000 → $ 36.000, por Ana, el 10/11 a las 9:15»
  visible en la pestaña «Cambios del catálogo».
- Kardex, compras y traslados piden páginas de 15 filas; ninguna pantalla descarga la tabla completa.
- Para quien usa la app nada se pierde: mismos filtros, mismo orden, mismos totales del encabezado, mismo «Te toca».
- Backend, frontend, lint, build (dentro del presupuesto de 650 kB) y E2E de negocio en verde.

## 2. Reutilización (pedido explícito)

Antes de crear algo, se usa lo existente; lo que ya está repetido se extrae una vez y se usa en todos lados.

**Se reutiliza tal cual**

| Pieza existente | Dónde se reutiliza |
|---|---|
| `DataTable` en modo servidor (`[total]`, `[(page)]`, `(sortChange)`, `exportAll`) | kardex, compras, traslados, cambios del catálogo |
| `ActiveFilters`, `AdvancedFilters`, `Select`, `MultiSelect`, `DatePicker`, `Segmented`, `Tabs`, `Badge` | todas las pantallas tocadas |
| `persistedFilter` y sus `codecs` | filtros recordados de las pantallas tocadas |
| `GET /api/v1/inventory/movements/search` y `/export` (auditoría) | kardex, ampliando sus parámetros |
| `LoginEventsPanel` (patrón de pestaña de auditoría) | modelo de la nueva pestaña «Cambios del catálogo» |
| `GET /purchases/{id}` y `GET /transfers/{id}` | detalle al abrir una orden o un traslado |
| Modales de detalle de compra y traslado | sin cambios de diseño; reciben el detalle pedido por id |
| Íconos Lucide ya cargados | ningún ícono nuevo (cada uno suma ~3 kB al arranque) |

**Se extrae porque ya está repetido**

| Lógica | Hoy repetida en | Queda como |
|---|---|---|
| Lista paginada en el servidor: página que vuelve a 1 al cambiar un filtro, consulta derivada, «solo manda la última respuesta», estados de carga y error, búsqueda con espera al tipear | historial de ventas, auditoría, inicios de sesión | `serverPagedList(...)` en `frontend-angular/src/app/shared/data/` (+ `debouncedText(...)`), usado también por kardex, compras, traslados y cambios del catálogo |
| Fecha local a `AAAA-MM-DD` para la API | `audit-api`, `login-audit-api`, `sales-api` | `toIsoDay` en `@shared/format/format` |
| Texto sin tildes, escape de `%`/`_` y expresión SQL comparable | `MovementSearchJdbcAdapter`, `LoginAuditJdbcAdapter`, `SalePersistenceAdapter` | `SqlText` en `shared/infrastructure/persistence` |
| Página segura (página ≥ 0, tamaño 1–100) y total de páginas | controladores de ventas, auditoría e inicios de sesión | `PageParams` en `shared/infrastructure/web` |

Las pantallas existentes que ya usan esa lógica (ventas, auditoría, inicios de sesión) pasan a usar los helpers
extraídos, con sus pruebas actuales como red: si siguen en verde, la extracción no cambió el comportamiento.

## 3. Auditoría de cambios del catálogo

**Qué se registra** (una fila por campo cambiado):

| Entidad | Campos |
|---|---|
| Producto | precio de venta · costo promedio (solo si se edita a mano) · activo · proveedores: agregado, quitado, precio pactado, preferido · stock mínimo por sucursal |
| Usuario | rol · sucursal · activo · creación |

El costo promedio que cambia al recibir una compra **no** se registra aquí: ya queda en el kardex y en el comprobante de
recepción.

**Datos** — migración `V11__Catalog_Audit.sql`, tabla `cambio_catalogo`:
`id`, `fecha`, `entidad` (`PRODUCTO` | `USUARIO`), `entidad_id`, `entidad_nombre` (foto), `campo`, `valor_anterior`,
`valor_nuevo`, `usuario_id`, `usuario_nombre` (foto). Índices por `fecha DESC` y por `(entidad, entidad_id)`.

**Captura** — en los servicios que aplican el cambio (`ProductService`, sus proveedores, el mínimo en
`InventoryService`, `UserService`): se compara antes y después y se escriben solo los campos distintos, **en la misma
transacción** que el cambio. Un comparador de dominio por entidad (`ProductChanges`, `UserChanges`) decide qué cambió y
cómo se muestra cada valor (dinero, sí/no, nombre de rol o sucursal); es puro y se prueba aparte.

**Consulta** — `GET /api/v1/audit/catalog-changes` (solo ADMIN): paginado, del más reciente al más antiguo, filtros por
entidad, fechas y texto (qué se cambió o quién). Reutiliza `SqlText` y `PageParams`.

**Pantalla** — tercera pestaña de Auditoría Global, «Cambios del catálogo», con el mismo diseño que «Inicios de sesión»:
Fecha · Qué (Producto «Cemento Gris 50Kg» / Usuario «Ana Ruiz») · Campo · Antes → Después · Quién.

## 4. Kardex paginado

- El panel de kardex usa `/movements/search` con la sucursal elegida fija (quien no es ADMIN, siempre la suya; regla ya
  existente en el controlador).
- `MovementSearchCriteria` acepta **listas** de productos y de motivos (`productId=3&productId=7`,
  `reason=VENTA&reason=MERMA`); la auditoría sigue funcionando, un valor es una lista de uno.
- Totales de entradas y salidas, y «Exportar CSV» (hasta 20.000 filas), salen del servidor como en la auditoría.
- Los endpoints viejos (`/branches/{b}/products/{p}/kardex`, `/movements`) quedan en el backend pero el frontend deja de
  usarlos.

## 5. Compras y traslados paginados

**Endpoints nuevos por pantalla**

- `GET /api/v1/purchases/search` y `GET /api/v1/transfers/search`: filas livianas (lo que muestra la tabla, sin líneas
  ni pagos) + `awaitsMe`. Filtros: los mismos de hoy; el de producto pasa de nombre a **id**.
- `GET /api/v1/purchases/summary` y `GET /api/v1/transfers/summary`: los totales del encabezado sobre todo lo visible
  (en curso, esperan tu acción, deuda con proveedores o transportistas, vencidas).
- Al abrir una fila se pide el detalle con el `GET /{id}` existente.

**«Te toca», en el backend**

| | Te toca si… |
|---|---|
| Compras | aprobar una orden por aprobar (ADMIN, MANAGER) · recibir una que viene en camino (ADMIN, MANAGER, operador) |
| Traslados | aprobar en destino (gerencia del destino) · autorizar salida (gerencia del origen) · despachar (operación del origen) · recibir (operación del destino) · resolver una novedad (gerencia de cualquiera de las dos) |

La regla vive en el dominio (`PurchaseActionPolicy`, `TransferActionPolicy`) y tiene una traducción SQL para filtrar y
contar. Una prueba recorre **todos los estados × roles × sucursal propia/ajena** y exige que Java y SQL coincidan. El
frontend conserva sus reglas solo para mostrar los botones del detalle; «Te toca» y los conteos vienen del servidor.

**Permisos:** sin cambios. Quien no es ADMIN ve solo su sucursal (compras: la que recibe; traslados: origen o destino).

## 6. Errores y casos borde

- Una consulta fallida muestra el error dentro de la tabla con «Reintentar» (comportamiento actual de `DataTable`).
- Filtros recordados con el formato anterior (producto por nombre) se descartan: las claves cambian, como se hizo en la
  auditoría.
- Si el detalle de una fila no carga, el modal muestra el error sin cerrar la lista.
- Registrar un cambio del catálogo nunca deja el cambio a medias: misma transacción.

## 7. Pruebas

| Capa | Qué se prueba |
|---|---|
| Dominio (JUnit) | `ProductChanges`/`UserChanges` (qué campos y con qué valores) · políticas «te toca» |
| SQL contra PostgreSQL real (Testcontainers) | filtros, orden, paginación y totales de cada búsqueda · equivalencia Java/SQL de «te toca» en todas las combinaciones · registro y consulta de `cambio_catalogo` |
| Controladores (`@WebMvcTest`) | parámetros, roles, sucursal forzada para quien no es ADMIN |
| Frontend (Vitest + MSW) | `serverPagedList` y `debouncedText` por sí solos · cada pantalla pide al servidor filtros, orden y página · detalle al abrir · pestaña «Cambios del catálogo» |
| E2E (Playwright) | ajustar compras, ajuste de stock y analítica a la carga por páginas · nuevo: cambiar el precio de un producto y encontrarlo en «Cambios del catálogo» |

Cada prueba nueva se valida rompiendo el código a propósito.

## 8. Orden de entrega

1. Extracciones de reutilización (`serverPagedList`, `debouncedText`, `toIsoDay`, `SqlText`, `PageParams`), aplicadas a
   ventas, auditoría e inicios de sesión sin cambiar su comportamiento.
2. Kardex en el servidor.
3. Auditoría del catálogo (V11, captura, endpoint, pestaña).
4. Compras en el servidor.
5. Traslados en el servidor.
6. Documentación (`REQUISITOS.md`: requisito nuevo de auditoría del catálogo; «Lo que no está implementado» sin las
   listas ya paginadas) y E2E.

Cada paso termina con pruebas en verde y su commit (sin marca de agua). Tras cada cambio del backend:
`npm run openapi:gen`.

## 9. Fuera de alcance

Historial dentro de cada ficha · auditar proveedores, unidades, sucursales y listas de precios · paginar Reportes ·
cambiar el diseño visual de las pantallas.
