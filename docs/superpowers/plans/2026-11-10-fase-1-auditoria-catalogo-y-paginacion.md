# Fase 1 — Auditoría del catálogo y paginación en el servidor: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** registrar y consultar los cambios de productos y usuarios, y que kardex, compras y traslados pidan al servidor
solo la página que se ve, sin perder filtros, orden, totales ni «Te toca».

**Architecture:** el backend (Spring Boot, hexagonal) suma búsquedas con SQL directo (`JdbcTemplate`), como ya hacen la
auditoría de movimientos y la de inicios de sesión; las reglas «te toca» pasan al dominio con una traducción SQL
verificada contra Java. El frontend (Angular, signals) extrae un helper de lista paginada en el servidor y lo usa en
todas las pantallas paginadas.

**Tech Stack:** Java 21, Spring Boot 3.5, PostgreSQL 16, Flyway, JdbcTemplate, JUnit 5, Mockito, Testcontainers ·
Angular 22, Vitest, Testing Library, MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-fase-1-auditoria-catalogo-y-paginacion-design.md`

## Global Constraints

- Reutilizar antes de crear: `DataTable` en modo servidor, `ActiveFilters`, `AdvancedFilters`, `Select`, `MultiSelect`,
  `DatePicker`, `Segmented`, `Tabs`, `Badge`, `persistedFilter`/`codecs`, `/movements/search`, `GET /purchases/{id}`,
  `GET /transfers/{id}`, modales de detalle existentes.
- Ningún ícono Lucide nuevo (cada uno suma ~3 kB al arranque). Presupuesto de arranque: **650 kB** (`angular.json`).
- Páginas de **15** filas en las pantallas; el servidor acepta tamaño **1–100**.
- Exportar CSV: hasta **20.000** filas (`MovementAuditService.MAX_EXPORT_ROWS`).
- Quien no es ADMIN ve solo su sucursal (compras: la que recibe; traslados: origen o destino; kardex: la suya).
- Registrar un cambio del catálogo va **en la misma transacción** que el cambio.
- El costo promedio que cambia al recibir una compra (`ProductService.updateAverageCost`) **no** se audita.
- Correr `npm test` desde `frontend-angular/` (no `ng test`). Backend con Java 21; en esta máquina:
  `docker run --rm --network host -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_RYUK_DISABLED=true -v "$PWD":/app -v zen-m2:/root/.m2 -w /app maven:3.9.6-eclipse-temurin-21-alpine mvn -B -ntp -q test`
  desde `backend/` (en adelante, **`MVN_TEST`**; agregar `-Dtest=Clase` para una sola clase).
- Tras cada cambio de contrato del backend: reconstruir el backend local (`docker compose up -d --build backend`) y
  `npm run openapi:gen`.
- Cada prueba nueva se valida rompiendo el código a propósito (debe fallar sin el cambio).
- Commits sin marca de agua (sin líneas `Co-Authored-By`), en la rama `BEMA_DES`.
- Textos de la interfaz en español.

## Review Focus

1. **Un usuario que no es ADMIN manda `branchId` de otra sucursal** en `/purchases/search`, `/transfers/search` o el
   kardex: debe ver solo la suya, nunca un 200 con datos ajenos. → pruebas en Tasks 7 y 9 (controlador).
2. **Saldo de compras y fletes en SQL distinto del dominio** (pagos anulados, orden cancelada, traslado sin costo de
   envío): el saldo de la tabla y la deuda del encabezado deben coincidir con `PurchaseOrder.balance()` y
   `Transfer.freightBalance()`. → pruebas de equivalencia en Tasks 7 y 9.
3. **Editar un producto sin cambiar nada** (o mandar el mismo precio con otra escala, `34000` vs `34000.00`): no debe
   crear filas de auditoría. → `ProductChangesTest` en Task 5.
4. **Filtros recordados con el formato viejo** (producto por nombre en compras y traslados): deben descartarse sin
   romper la pantalla. → pruebas de pantalla en Tasks 8 y 10.
5. **Respuestas que llegan fuera de orden** al cambiar rápido de página o filtro: la tabla muestra la última pedida. →
   prueba de `serverPagedList` en Task 2.

---

### Task 1: Helpers compartidos del backend (`SqlText`, `PageParams`)

**Files:**
- Create: `backend/src/main/java/co/com/zenvory/inventario/shared/infrastructure/persistence/SqlText.java`
- Create: `backend/src/main/java/co/com/zenvory/inventario/shared/infrastructure/web/PageParams.java`
- Modify: `inventory/infrastructure/adapter/out/persistence/MovementSearchJdbcAdapter.java`,
  `auth/infrastructure/adapter/out/audit/LoginAuditJdbcAdapter.java`,
  `sale/infrastructure/adapter/out/persistence/SalePersistenceAdapter.java` (solo su normalización de texto),
  `inventory/infrastructure/adapter/in/web/MovementAuditController.java`,
  `auth/infrastructure/adapter/in/web/LoginAuditController.java`,
  `sale/infrastructure/adapter/in/web/SaleController.java` (cálculo de página)
- Test: `backend/src/test/java/co/com/zenvory/inventario/shared/infrastructure/persistence/SqlTextTest.java`,
  `backend/src/test/java/co/com/zenvory/inventario/shared/infrastructure/web/PageParamsTest.java`

**Interfaces:**
- Produces:
  - `SqlText.normalize(String text): String` — minúsculas, sin tildes, recortado.
  - `SqlText.containsPattern(String word): String` — `%palabra%` con `\`, `%`, `_` escapados.
  - `SqlText.plain(String column): String` — `translate(lower(coalesce(<col>, '')), 'áéíóúüñ', 'aeiouun')`.
  - `SqlText.words(String text, int max): List<String>` — palabras normalizadas, sin `#`, hasta `max`.
  - `record PageParams(int page, int size)` con `static PageParams of(int page, int size)` (página ≥ 0, tamaño 1–100) y
    `int totalPages(long totalElements)`.

- [ ] **Step 1: Write the failing tests**
  - `SqlTextTest.normalize_quitaTildesYMayusculas`: `normalize("  REVISIÓN Ñandú ")` → `"revision nandu"`.
  - `SqlTextTest.containsPattern_escapaComodines`: `containsPattern("100%_a\\b")` → `"%100\\%\\_a\\\\b%"`.
  - `SqlTextTest.words_sinNumeralYConLimite`: `words("Venta  #41 x y z w", 5)` → `["venta","41","x","y","z"]`; `words(null,5)` → `[]`.
  - `PageParamsTest.acota`: `of(-3, 5000)` → `(0, 100)`; `of(2, 0)` → `(2, 1)`; `of(0, 15).totalPages(31)` → `3`; `totalPages(0)` → `0`.
- [ ] **Step 2: Run** `MVN_TEST -Dtest='SqlTextTest,PageParamsTest'` — Expected: FAIL (clases inexistentes).
- [ ] **Step 3: Implement** `SqlText` y `PageParams` (clases finales sin estado) con las firmas de arriba.
- [ ] **Step 4: Refactor** los tres adaptadores y los tres controladores para usarlos (borrar sus `normalize`,
  `escapeLike`, `PLAIN` y cálculos de página propios). Sin cambio de comportamiento.
- [ ] **Step 5: Run** `MVN_TEST` completo — Expected: todas en verde (las de búsqueda de movimientos, inicios de sesión y
  ventas son la red de la refactorización).
- [ ] **Step 6: Commit** `refactor(backend): SqlText y PageParams compartidos para las búsquedas`

---

### Task 2: Helpers compartidos del frontend (`toIsoDay`, `debouncedText`, `serverPagedList`)

**Files:**
- Modify: `frontend-angular/src/app/shared/format/format.ts` (+ `toIsoDay`)
- Create: `frontend-angular/src/app/shared/data/server-paged-list.ts`, `frontend-angular/src/app/shared/data/debounced-text.ts`
- Modify (usarlos): `features/audit/data-access/audit-api.ts`, `features/audit/data-access/login-audit-api.ts`,
  `features/sales/data-access/sales-api.ts`, `features/audit/pages/audit-page/audit-page.ts`,
  `features/audit/components/login-events-panel/login-events-panel.ts`,
  `features/sales/pages/sales-history-page/sales-history-page.ts`
- Test: `shared/format/format.spec.ts` (caso nuevo), `shared/data/server-paged-list.spec.ts`, `shared/data/debounced-text.spec.ts`

**Interfaces:**
- Produces:
  - `toIsoDay(date: Date): string` — día local `AAAA-MM-DD`.
  - `debouncedText(delayMs = 300): { text: WritableSignal<string>; term: Signal<string>; set(value: string): void; clear(): void }`
    — `text` sigue cada tecla; `term` se actualiza `delayMs` después de la última, recortado; `clear()` vacía ambos sin
    esperar. Limpia su temporizador con `DestroyRef`.
  - `serverPagedList<F, R>(options: { filters: Signal<F>; sort?: Signal<{ key: string; direction: 'asc' | 'desc' } | null>; size: number; fetch: (query: F & { page: number; size: number; sort: … | null }) => Observable<{ rows: R[]; total: number }> }): ServerPagedList<R>`
    con `ServerPagedList<R> = { rows: Signal<readonly R[]>; total: Signal<number>; loading: Signal<boolean>; error: Signal<string | null>; page: WritableSignal<number>; query: Signal<…>; reload(silent?: boolean): Promise<void> }`.
    La página vuelve a 1 cuando cambian `filters` (`linkedSignal`); solo la última respuesta se aplica; el error se pasa
    por `toApiError(error).message`. Debe llamarse en contexto de inyección.

- [ ] **Step 1: Write the failing tests**
  - `toIsoDay(new Date(2026, 9, 5, 23, 30))` → `'2026-10-05'`.
  - `debounced-text.spec`: con `vi.useFakeTimers()`, `set('a')`, `set('ab ')`, avanzar 299 ms → `term()` `''`; avanzar 1 ms → `'ab'`; `clear()` → `text()` y `term()` `''`.
  - `server-paged-list.spec`:
    - `pide la página 1 con los filtros y el tamaño` (fetch espía recibe `{...filtros, page: 1, size: 15, sort: null}`).
    - `cambiar un filtro vuelve a la página 1`.
    - `solo aplica la última respuesta` (dos fetch con `Subject`; responder el segundo y luego el primero → `rows()` del segundo). **(Review Focus 5)**
    - `un error queda en error() y loading() en false`.
- [ ] **Step 2: Run** `npm test -- --include src/app/shared` — Expected: FAIL.
- [ ] **Step 3: Implement** los tres helpers.
- [ ] **Step 4: Refactor** las tres pantallas y los tres clientes de API para usarlos (borrar `loadId`, `searchTimer`,
  `SEARCH_DELAY_MS`, `isoDay` locales).
- [ ] **Step 5: Run** `npm test` y `npm run lint` — Expected: verde (las pruebas existentes de ventas, auditoría e
  inicios de sesión son la red).
- [ ] **Step 6: Commit** `refactor(frontend): lista paginada en el servidor y búsqueda con espera compartidas`

---

### Task 3: `/movements/search` con varios productos y motivos

**Files:**
- Modify: `inventory/application/port/out/MovementSearchCriteria.java` (`Long productId` → `List<Long> productIds`,
  `MovementReason reason` → `List<MovementReason> reasons`), `MovementSearchJdbcAdapter.java` (`= ANY(?)`),
  `MovementAuditController.java` (`@RequestParam(required = false) List<Long> productId`, `List<MovementReason> reason`),
  pruebas existentes que construyen el criterio.
- Test: `MovementSearchJdbcAdapterTest`, `MovementAuditControllerTest`

**Interfaces:**
- Produces: `MovementSearchCriteria(Long branchId, MovementType type, List<MovementReason> reasons, LocalDate from, LocalDate to, List<Long> productIds, Long userId, BigDecimal minQuantity, BigDecimal maxQuantity, boolean onlyObserved, String text)`;
  listas vacías o `null` = sin filtro. Query string: `productId=3&productId=7`, `reason=VENTA&reason=MERMA`.

- [ ] **Step 1: Write the failing tests**
  - `MovementSearchJdbcAdapterTest.filtraVariosProductosYMotivos`: con los 4 movimientos del `@BeforeEach`, `productIds=[1,3]` → `sale, shrinkage, transferOut`; `reasons=[VENTA, MERMA]` → `sale, shrinkage`.
  - `MovementAuditControllerTest`: `?productId=1&productId=3&reason=VENTA&reason=MERMA` llega como `List.of(1L,3L)` y `List.of(VENTA, MERMA)`.
- [ ] **Step 2: Run** `MVN_TEST -Dtest='MovementSearchJdbcAdapterTest,MovementAuditControllerTest'` — Expected: FAIL.
- [ ] **Step 3: Implement** el cambio de criterio y SQL (`m.producto_id = ANY(?)` con `createArrayOf("bigint", …)`; motivos con `"varchar"`).
- [ ] **Step 4: Run** `MVN_TEST` — Expected: verde. Reconstruir backend y `npm run openapi:gen`; ajustar `audit-api.ts`
  (manda un elemento por lista) y correr `npm test -- --include src/app/features/audit` — verde.
- [ ] **Step 5: Commit** `feat(inventario): la búsqueda de movimientos acepta varios productos y motivos`

---

### Task 4: Kardex paginado en el servidor

**Files:**
- Move: el cliente de búsqueda de movimientos de `features/audit/data-access/audit-api.ts` a
  `frontend-angular/src/app/core/inventory/movement-search-api.ts` (`MovementSearchApi`, tipos `AuditMovement` →
  `MovementRecord`, `AuditQuery` → `MovementQuery`); `audit-api.ts` queda como reexport o se borra y sus usuarios importan
  de `core`.
- Modify: `features/inventory/components/kardex-panel/kardex-panel.ts` (usa `MovementSearchApi` + `serverPagedList`,
  `DataTable` con `[total]`, `[(page)]`, `(sortChange)`, `exportAll`)
- Modify: `features/inventory/data-access/inventory-api.ts` (borrar `movements(...)` y su tipo si nadie más lo usa)
- Test: `kardex-panel.spec.ts` (reescrito al estilo de `audit-page.spec.ts`)

**Interfaces:**
- Consumes: `serverPagedList`, `debouncedText`, `toIsoDay` (Task 2); `MovementSearchCriteria` con listas (Task 3).
- Produces: `MovementSearchApi.search(query: MovementQuery): Observable<{ movements: MovementRecord[]; total: number; totalIn: number; totalOut: number }>`
  y `exportAll(query: MovementQuery): Observable<MovementRecord[]>`, con `MovementQuery.productIds: readonly number[]` y
  `reasons: readonly MovementReason[]`.

- [ ] **Step 1: Write the failing tests** (`kardex-panel.spec.ts`, MSW sobre `/movements/search` y `/export`):
  - `pide la página 1 de la sucursal elegida, del más reciente al más antiguo` (`branchId=3`, `page=0`, `size=15`, `sortBy=date`, `direction=desc`).
  - `varios productos y motivos se mandan como listas` (`productId=7&productId=8`, `reason=VENTA&reason=MERMA`).
  - `el rango de fechas y la búsqueda se mandan al servidor` (reloj fijo en 2026-10-20 como hoy).
  - `muestra el saldo resultante que manda el servidor` y `el resumen de entradas y salidas es del servidor`.
  - `exportar trae todo lo filtrado`.
- [ ] **Step 2: Run** `npm test -- --include src/app/features/inventory` — Expected: FAIL.
- [ ] **Step 3: Implement** el movimiento del cliente a `core` y el panel con los helpers.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build` (≤ 650 kB) — Expected: verde.
- [ ] **Step 5: Commit** `feat(kardex): paginar, filtrar y ordenar en el servidor`

---

### Task 5: Auditoría del catálogo — dominio, datos y captura

**Files:**
- Create: `backend/src/main/resources/db/migration/V11__Catalog_Audit.sql` (tabla `cambio_catalogo` según la spec §3;
  `CHECK (entidad IN ('PRODUCTO','USUARIO'))`; índices `fecha DESC` y `(entidad, entidad_id)`)
- Create (módulo nuevo `co.com.zenvory.inventario.audit`):
  - `audit/domain/model/CatalogChange.java` — `record CatalogChange(Long id, LocalDateTime date, ChangedEntity entity, Long entityId, String entityName, String field, String before, String after, Long userId, String userName)`
  - `audit/domain/model/ChangedEntity.java` — `enum { PRODUCTO, USUARIO }`
  - `audit/domain/model/FieldChange.java` — `record FieldChange(String field, String before, String after)`
  - `audit/domain/service/ProductChanges.java`, `audit/domain/service/UserChanges.java` (puros)
  - `audit/application/port/out/CatalogChangePort.java`, `audit/application/port/in/CatalogAuditUseCase.java`,
    `audit/application/service/CatalogAuditService.java`
  - `audit/infrastructure/adapter/out/CatalogChangeJdbcAdapter.java`
- Create: `shared/application/port/CurrentActorPort.java` (`record Actor(Long id, String name)`; `Actor current()`) y
  `shared/infrastructure/security/SecurityCurrentActor.java` (lo resuelve con `CurrentUser.resolve`)
- Modify: `catalog/application/service/ProductService.java` (`updateProduct`, `deleteProduct`),
  `inventory/application/service/InventoryService.java` (`updateMinimumStock`),
  `auth/application/service/UserService.java` (`createUser`, `updateUser`, `deactivateUser`)
- Test: `audit/domain/service/ProductChangesTest.java`, `UserChangesTest.java`,
  `audit/infrastructure/adapter/out/CatalogChangeJdbcAdapterTest.java` (Testcontainers), pruebas existentes de los tres
  servicios (nuevo mock de `CatalogAuditUseCase`).

**Interfaces:**
- Produces:
  - `ProductChanges.diff(Product before, Product after, Function<Long, String> supplierName): List<FieldChange>` —
    campos y textos exactos: `"Precio de venta"`, `"Costo promedio"` (dinero `$ 34.000`), `"Estado"` (`Activo`/`Inactivo`),
    `"Proveedor <nombre>"` con valores `—` → `Agregado · $ 28.000 · 3 días` / `… → Quitado`, `"Precio pactado (<nombre>)"`,
    `"Preferido (<nombre>)"` (`Sí`/`No`). Compara `BigDecimal` con `compareTo` **(Review Focus 3)**.
  - `ProductChanges.minimumStock(BigDecimal before, BigDecimal after, String branchName): Optional<FieldChange>` — campo
    `"Stock mínimo (<sucursal>)"`.
  - `UserChanges.diff(User before, User after, Function<Long, String> branchName): List<FieldChange>` — `"Rol"`,
    `"Sucursal"` (`—` si no tiene), `"Estado"`; `UserChanges.created(User user, …)`: una fila `"Cuenta"` `—` → `Creada · <rol>`.
  - `CatalogAuditUseCase.record(ChangedEntity entity, Long entityId, String entityName, List<FieldChange> changes): void`
    (no hace nada con lista vacía; toma quién y cuándo de `CurrentActorPort`) y
    `search(CatalogChangePort.Criteria criteria, PageParams page): CatalogChangePort.Page`.
  - `CatalogChangePort.Criteria(ChangedEntity entity, LocalDate from, LocalDate to, String text)`;
    `Page(List<CatalogChange> content, long totalElements)`.

- [ ] **Step 1: Write the failing tests**
  - `ProductChangesTest`: `sinCambios_noDevuelveNada` (mismo precio `34000` vs `34000.00`); `precioYEstado`; `costoSoloSiCambia`;
    `proveedorAgregadoQuitadoYPrecioPactado`; `minimoPorSucursal`.
  - `UserChangesTest`: `rolSucursalYEstado`; `creacion`; `sinCambios_noDevuelveNada`.
  - `CatalogChangeJdbcAdapterTest`: `registraYListaDelMasReciente`; `filtraPorEntidadFechaYTexto` (texto sin tildes, por
    nombre de la entidad o de quien lo hizo); `pagina`.
  - En los tests de servicio existentes: `ProductServiceTest.updateProduct_registraLosCambios` (verifica
    `record(PRODUCTO, id, nombre, [Precio de venta …])`), `UserServiceTest.updateUser_registraRol`,
    `InventoryServiceTest.updateMinimumStock_registraElMinimo`, y que `updateAverageCost` **no** registra nada.
- [ ] **Step 2: Run** `MVN_TEST -Dtest='ProductChangesTest,UserChangesTest,CatalogChangeJdbcAdapterTest,ProductServiceTest,UserServiceTest,InventoryServiceTest'` — Expected: FAIL.
- [ ] **Step 3: Implement** migración, dominio, puertos, adaptador (reutiliza `SqlText`) y los ganchos en los servicios
  (leer antes, aplicar, guardar, `record(...)`, todo dentro del `@Transactional` existente).
- [ ] **Step 4: Run** `MVN_TEST` completo — Expected: verde.
- [ ] **Step 5: Commit** `feat(auditoria): registrar los cambios de productos y usuarios`

---

### Task 6: Auditoría del catálogo — consulta y pestaña

**Files:**
- Create: `audit/infrastructure/adapter/in/web/CatalogAuditController.java` (`GET /api/v1/audit/catalog-changes`,
  `@PreAuthorize("hasRole('ADMIN')")`, params `page`, `size`, `entity`, `from`, `to`, `q`; respuesta
  `{content: [{id, date, entity, entityId, entityName, field, before, after, userName}], totalElements, page, size, totalPages}`)
- Create: `frontend-angular/src/app/features/audit/data-access/catalog-audit-api.ts`,
  `frontend-angular/src/app/features/audit/components/catalog-changes-panel/catalog-changes-panel.ts` (mismo diseño que
  `LoginEventsPanel`; filtros: búsqueda, entidad «Productos/Usuarios», desde, hasta)
- Modify: `features/audit/pages/audit-page/audit-page.ts` (tercera pestaña `'catalog'`, «Cambios del catálogo», ícono
  existente `LucideTag`; `codecs.oneOf(['movements','logins','catalog'])`)
- Test: `CatalogAuditControllerTest.java`, `catalog-changes-panel.spec.ts`, `audit-page.spec.ts` (caso de pestaña)

**Interfaces:**
- Consumes: `CatalogAuditUseCase.search` (Task 5), `PageParams` (Task 1), `serverPagedList`/`debouncedText`/`toIsoDay` (Task 2).

- [ ] **Step 1: Write the failing tests**
  - `CatalogAuditControllerTest.pasaFiltrosYDevuelveLaPagina`, `soloAdmin` (anotación `hasRole('ADMIN')`).
  - `catalog-changes-panel.spec`: `muestra Qué · Campo · Antes → Después · Quién` (fila «Producto «Cemento Gris 50Kg»», «Precio de venta», «$ 34.000 → $ 36.000», «Ana Ruiz»); `los filtros se mandan al servidor`; `vacío y con filtros dice que ninguno coincide`; `error en la tabla`; accesibilidad.
  - `audit-page.spec`: `«Cambios del catálogo» abre el panel y se recuerda`.
- [ ] **Step 2: Run** las tres suites — Expected: FAIL.
- [ ] **Step 3: Implement** controlador, reconstruir backend, `npm run openapi:gen`, cliente, panel y pestaña.
- [ ] **Step 4: Run** `MVN_TEST`, `npm test`, `npm run lint`, `npm run build` (≤ 650 kB) — Expected: verde.
- [ ] **Step 5: Commit** `feat(auditoria): pestaña «Cambios del catálogo»`

---

### Task 7: Compras en el servidor — backend

**Files:**
- Create: `shared/domain/Viewer.java` — `record Viewer(boolean admin, boolean manager, boolean operational, Long branchId)`
  (dominio, sin dependencias de Spring) y `shared/infrastructure/security/Viewers.java` con
  `static Viewer from(CurrentUser current)` (ADMIN ⇒ las tres en `true`; MANAGER ⇒ `manager` y `operational`;
  OPERADOR_INVENTARIO ⇒ `operational`; SELLER ⇒ ninguna). Lo usan Tasks 7 y 9.
- Create: `purchase/domain/service/PurchaseActionPolicy.java` — `static boolean awaits(ReceptionStatus status, Viewer viewer)`:
  `AWAITING_APPROVAL && manager` o `IN_TRANSIT && operational`.
- Create: `purchase/application/port/out/PurchaseSearchPort.java` (`Criteria`, `Row`, `Page`, `Summary`),
  `purchase/infrastructure/adapter/out/persistence/PurchaseSearchJdbcAdapter.java`
- Modify: `purchase/application/port/in/PurchaseUseCase.java` + `PurchaseService.java` (`search`, `summary`),
  `PurchaseController.java` (`GET /search`, `GET /summary`)
- Test: `PurchaseActionPolicyTest.java`, `PurchaseSearchJdbcAdapterTest.java` (Testcontainers), `PurchaseControllerTest.java`

**Interfaces:**
- Produces:
  - `PurchaseSearchPort.Criteria(String status /* "open" | "all" | ReceptionStatus */, PaymentStatus payment, LocalDate from, LocalDate to, Long supplierId, Long branchId, Long productId, BigDecimal minTotal, BigDecimal maxTotal, boolean onlyMine, String text, Viewer viewer)`.
  - `Row(Long id, ReceptionStatus reception, PaymentStatus payment, Long supplierId, String supplierName, Long branchId, String branchName, BigDecimal total, BigDecimal balance, boolean overdue, LocalDateTime requestDate, boolean awaitsMe)`.
  - `Page(List<Row> content, long totalElements)`; `Summary(long open, long awaitingMe, BigDecimal owed, long owedCount, long overdue)`.
  - SQL: `balance` = `0` si `estado_recepcion='CANCELLED'`, si no `GREATEST(total - SUM(pagos no anulados), 0)`;
    `overdue` = `balance > 0 AND fecha_vencimiento_pago < now()`; abiertas = `AWAITING_APPROVAL, PENDING, IN_TRANSIT, RECEIVED_PARTIAL`;
    texto = `id` o nombre del proveedor (`SqlText`); orden por `id`, `reception`, `supplier`, `branch`, `total`, `balance`,
    `payment`, `requestDate` (lista blanca; otro valor → `id DESC`).
  - Endpoints: `GET /api/v1/purchases/search?page&size&sortBy&direction&status&payment&from&to&supplierId&branchId&productId&minTotal&maxTotal&onlyMine&q`
    → `{content, totalElements, page, size, totalPages}`; `GET /api/v1/purchases/summary` → `{open, awaitingMe, owed, owedCount, overdue}`.
    Quien no es ADMIN: `branchId` forzado a su sucursal (`CurrentUser.resolveBranch(null)`).

- [ ] **Step 1: Write the failing tests**
  - `PurchaseActionPolicyTest`: tabla estado × rol (ADMIN, MANAGER, OPERADOR_INVENTARIO, SELLER).
  - `PurchaseSearchJdbcAdapterTest`: un caso por filtro; `orden y página`; `saldo con pagos anulados y orden cancelada coincide con PurchaseOrder.balance()` **(Review Focus 2)**;
    `awaitsMe_SQL_coincide_con_la_politica_para_todos_los_estados_y_roles` (inserta una orden por estado; para cada `Viewer`
    compara `row.awaitsMe()` y el filtro `onlyMine` con `PurchaseActionPolicy.awaits`); `summary_cuenta_todo_lo_visible`.
  - `PurchaseControllerTest`: `gerente_no_ve_otra_sucursal_aunque_la_pida` **(Review Focus 1)**; parámetros llegan al criterio.
- [ ] **Step 2: Run** `MVN_TEST -Dtest='PurchaseActionPolicyTest,PurchaseSearchJdbcAdapterTest,PurchaseControllerTest'` — Expected: FAIL.
- [ ] **Step 3: Implement** política, puerto, adaptador (reutiliza `SqlText`, `PageParams`), servicio y endpoints.
- [ ] **Step 4: Run** `MVN_TEST` completo — Expected: verde.
- [ ] **Step 5: Commit** `feat(compras): búsqueda paginada y resumen en el servidor con «te toca» en el dominio`

---

### Task 8: Compras en el servidor — pantalla

**Files:**
- Modify: `features/purchases/data-access/purchases-api.ts` (`search`, `summary`; `PurchaseListRow`),
  `features/purchases/pages/purchases-page/purchases-page.ts` y `.html` (usa `serverPagedList`; filtro de producto por id
  con clave `productId`; detalle con `GET /purchases/{id}` al abrir; encabezado con `summary`)
- Test: `purchases-page.spec.ts` (reescribir los casos de lista y filtros al estilo de `audit-page.spec.ts`; los de
  detalle, pago, anulación y recepción se conservan, ahora con el detalle pedido por id)

**Interfaces:**
- Consumes: endpoints de Task 7; `serverPagedList`, `debouncedText`, `toIsoDay` (Task 2).

- [ ] **Step 1: Write the failing tests**: `pide la primera página en curso`; cada filtro y `onlyMine` se mandan;
  `ordenar pide el campo al servidor`; `«Te toca» viene del servidor`; `el encabezado usa /summary`;
  `abrir una orden pide su detalle`; `un filtro de producto guardado por nombre se descarta` **(Review Focus 4)**.
- [ ] **Step 2: Run** `npm test -- --include src/app/features/purchases` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build` (≤ 650 kB); E2E `e2e/negocio/compras.e2e.ts` y
  `ajuste-stock.e2e.ts` con `E2E_USER=admin@demo.zeninventory.co E2E_PASSWORD='Demo-2026*'` — Expected: verde.
- [ ] **Step 5: Commit** `feat(compras): la lista pide al servidor solo la página que se ve`

---

### Task 9: Traslados en el servidor — backend

**Files:**
- Create: `transfer/domain/service/TransferActionPolicy.java` — `static boolean awaits(TransferStatus status, Long originId, Long destinationId, Viewer viewer)`:
  `PENDING`+gerencia del destino · `APPROVED_DEST`+gerencia del origen · `PREPARING`+operación del origen ·
  `IN_TRANSIT`+operación del destino · `WITH_ISSUE`+gerencia de cualquiera (ADMIN cuenta como ambas sucursales).
- Create: `transfer/application/port/out/TransferSearchPort.java`, `transfer/infrastructure/adapter/out/persistence/TransferSearchJdbcAdapter.java`
- Modify: `TransferUseCase.java`, `TransferService.java`, `TransferController.java` (`GET /search`, `GET /summary`)
- Test: `TransferActionPolicyTest.java`, `TransferSearchJdbcAdapterTest.java` (Testcontainers), `TransferControllerTest.java`

**Interfaces:**
- Consumes: `Viewer`, `SqlText`, `PageParams`.
- Produces:
  - `Criteria(String status /* "open" | "all" | TransferStatus */, String direction /* all|incoming|outgoing */, TransferPriority priority, LocalDate from, LocalDate to, Long originId, Long destinationId, Long productId, boolean onlyMine, String text, Viewer viewer)`.
  - `Row(Long id, TransferStatus status, TransferPriority priority, Long originId, String originName, Long destinationId, String destinationName, String firstProductName, int productCount, FreightPaymentStatus freightStatus, BigDecimal freightBalance, LocalDateTime requestDate, boolean awaitsMe)`.
  - `Summary(long open, long awaitingMe, BigDecimal freightOwed, long freightOwedCount)`.
  - SQL: abiertos = `PENDING, APPROVED_DEST, PREPARING, IN_TRANSIT, WITH_ISSUE, UNDER_CLAIM`; `freightBalance` = `0` si
    `fecha_despacho IS NULL OR COALESCE(costo_envio,0) <= 0`, si no `GREATEST(costo_envio - SUM(pagos no anulados), 0)`;
    `freightStatus` igual que `Transfer.freightPaymentStatus()`; texto = id, nombres de las sucursales y de los productos;
    orden por `id`, `status`, `route` (origen, destino), `priority`, `freight`, `requestDate`.
  - Quien no es ADMIN ve traslados donde su sucursal es origen o destino.

- [ ] **Step 1: Write the failing tests**: tabla de la política; filtros (incluida dirección), orden y página;
  `flete con pagos anulados y sin costo coincide con Transfer.freightBalance()/freightPaymentStatus()` **(Review Focus 2)**;
  `awaitsMe_SQL_coincide_con_la_politica` (estados × roles × origen/destino/ajena); `summary`;
  `gerente_no_ve_traslados_de_otras_sucursales` **(Review Focus 1)**.
- [ ] **Step 2: Run** `MVN_TEST -Dtest='TransferActionPolicyTest,TransferSearchJdbcAdapterTest,TransferControllerTest'` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `MVN_TEST` completo — Expected: verde.
- [ ] **Step 5: Commit** `feat(traslados): búsqueda paginada y resumen en el servidor con «te toca» en el dominio`

---

### Task 10: Traslados en el servidor — pantalla

**Files:**
- Modify: `features/transfers/data-access/transfers-api.ts` (`search`, `summary`; `TransferListRow`),
  `features/transfers/pages/transfers-page/transfers-page.ts` y `.html` (usa `serverPagedList`; producto por id con clave
  `productId`; columna «Productos» = `firstProductName` y `+N` si `productCount > 1`; detalle por id al abrir; resumen)
- Test: `transfers-page.spec.ts` (igual criterio que Task 8; se conservan los casos de detalle, acciones y solicitud)

**Interfaces:**
- Consumes: endpoints de Task 9; helpers de Task 2.

- [ ] **Step 1: Write the failing tests**: análogos a Task 8, más `dirección entrantes/salientes se manda al servidor` y
  `un filtro de producto guardado por nombre se descarta` **(Review Focus 4)**.
- [ ] **Step 2: Run** `npm test -- --include src/app/features/transfers` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build` (≤ 650 kB); E2E de negocio completo — Expected: verde.
- [ ] **Step 5: Commit** `feat(traslados): la lista pide al servidor solo la página que se ve`

---

### Task 11: Documentación y E2E de la fase

**Files:**
- Modify: `docs/REQUISITOS.md` (requisito RF-66 «Registrar y consultar los cambios de precio, costo, estado, proveedores
  y mínimo de los productos, y de rol, sucursal y estado de los usuarios»; RNF-08 con compras, traslados y kardex
  paginados; «Lo que no está implementado»: solo quedan Reportes en el navegador), `documentacion_tecnica.md` (§7.3
  auditoría con tres pestañas; §8.1 cantidades de pruebas)
- Create: `frontend-angular/e2e/negocio/catalogo.e2e.ts` — cambia el precio de un producto, lo vuelve a dejar como
  estaba, y comprueba las dos filas en «Cambios del catálogo».

- [ ] **Step 1: Write the E2E** y correrlo — Expected: FAIL solo si falta algo de las tareas anteriores; si no, PASS a la primera.
- [ ] **Step 2: Run** suite completa: `MVN_TEST`, `npm run lint`, `npm test`, `npm run build`, E2E de negocio — Expected: verde.
- [ ] **Step 3: Update** la documentación con las cifras reales de la corrida.
- [ ] **Step 4: Commit** `docs: fase 1 — auditoría del catálogo y listas paginadas`
