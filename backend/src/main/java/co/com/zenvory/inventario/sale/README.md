# Módulo `sale` — Ventas y devoluciones

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Dos áreas en un mismo módulo:

1. **Ventas** – registrar una venta en el punto de venta (calcula precios y descuentos, descuenta stock), consultarlas
   (historial paginado y filtrado en el servidor) y **anularlas** (devuelve el stock).
2. **Devoluciones** – un vendedor solicita devolver productos de una venta ya hecha; un gerente la aprueba o rechaza.
   Al aprobar, el stock vuelve a la sucursal.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `ventas` | Cabecera: `fecha`, `sucursal_id`, `usuario_id`, `subtotal`, `descuento_total`, `total_final`, `estado`, `motivo_anulacion`, `cliente_nombre`/`cliente_documento`, `global_discount_percentage`, y la "foto" `sucursal_nombre` + `vendedor_nombre` |
| `detalles_venta` | Líneas: `producto_id`, `producto_nombre` (foto), `cantidad`, `precio_unitario_aplicado`, `porcentaje_descuento`, `subtotal_linea` |
| `solicitudes_devolucion` | `venta_id`, `sucursal_id`, `solicitante_id`, `aprobador_id`, `estado`, `motivo_general`, `comentario_aprobador`, fechas |
| `detalles_devolucion_solicitud` | Líneas: `producto_id`, `cantidad`, `motivo_especifico`, `precio_unidad_venta` |

Las líneas se borran en cascada con su cabecera. El «nombre» del producto, sucursal y vendedor se guarda como *foto*
para que el historial no cambie si luego se renombran.

## Qué hace cada carpeta

```
sale/
├── domain/
│   ├── model/
│   │   ├── Sale                 Venta. Sale.create(...) CALCULA subtotal, descuentos de línea, descuento global y
│   │   │                        total. Métodos: cancel(motivo), markAsReturned(), effectiveUnitPaid(producto)
│   │   │                        (lo realmente pagado por unidad, para devolver al precio correcto), soldUnits()
│   │   ├── SaleDetail           Línea de venta (cantidad, precio aplicado, % descuento, subtotal)
│   │   ├── SaleStatus           COMPLETED | CANCELED | RETURNED
│   │   ├── ReturnRequest        Solicitud de devolución (create / approve / reject)
│   │   ├── ReturnRequestDetail  Línea de la solicitud
│   │   └── ReturnRequestStatus  PENDIENTE | APROBADA | RECHAZADA
│   └── exception/               EmptySale, SaleNotFound, InvalidSaleState, InvalidReturnOperation, ReturnRequestNotFound
│
├── application/
│   ├── port/in/
│   │   ├── CreateSaleUseCase + CreateSaleCommand   Registrar una venta
│   │   ├── SaleManagementUseCase                   Consultar / anular / cambiar estado / buscar paginado
│   │   └── ReturnRequestUseCase + CreateReturnRequestCommand   Devoluciones
│   ├── port/out/
│   │   ├── SaleRepositoryPort            save, findById, findByIdForUpdate (bloquea), findAll, findByBranchId, search, filterOptions
│   │   ├── ReturnRequestRepositoryPort   persistencia de devoluciones
│   │   └── SaleSearchCriteria / SalePage / SaleFilterOptions   Objetos del historial paginado
│   └── service/
│       ├── SaleService            Crea y anula ventas, busca el historial
│       └── ReturnRequestService   Crea, aprueba y rechaza devoluciones
│
└── infrastructure/adapter/
    ├── in/web/
    │   ├── SaleController           /api/v1/sales
    │   ├── ReturnRequestController  /api/v1/returns
    │   └── SaleRequest/Response, SalePageResponse, SaleFilterOptionsResponse, ReturnRequestResponse
    └── out/persistence/
        ├── SaleEntity, SaleDetailEntity, ReturnRequestEntity, ReturnRequestDetailEntity
        ├── JpaSaleRepository (con JpaSpecificationExecutor + consultas DISTINCT), JpaReturnRequestRepository
        └── SalePersistenceAdapter (incluye la búsqueda con filtros), ReturnRequestPersistenceAdapter
```

## Flujo 1: registrar una venta (`SaleService.execute`, transaccional)

1. El controller toma al vendedor y la sucursal de `CurrentUser` (ignora lo que venga en el JSON).
2. Por cada ítem: busca el producto (`catalog`) y resuelve el precio con esta jerarquía:
   **lista de la línea → lista global de la venta → precio base del producto** (`pricelist`).
3. **Pre-valida el stock de todas las líneas antes de guardar nada** (`inventory`).
4. Toma los nombres de sucursal y vendedor (la "foto").
5. `Sale.create(...)` — el dominio calcula los totales.
6. Guarda la venta y **descuenta el stock** línea por línea (`InventoryUseCase.withdrawStock`).

Si cualquier paso falla, **todo se revierte** (no queda una venta sin descontar ni al revés).

## Flujo 2: anular una venta

`DELETE /api/v1/sales/{id}?reason=…` (ADMIN, MANAGER):
1. Lee la venta **con la fila bloqueada** (`findByIdForUpdate`): una anulación y una devolución simultáneas se
   serializan.
2. Si el usuario no es ADMIN, la venta debe ser de su sucursal.
3. `sale.cancel(motivo)` en el dominio: exige un motivo y rechaza si ya estaba `CANCELED` o si tiene devoluciones
   aprobadas (`RETURNED`: ya se repuso ese stock y se repondría dos veces).
4. Repone el stock con `addStock` **sin costo** (reponer no es comprar: no debe mover el costo promedio).

## Flujo 3: devolución

1. **Solicitar** (`createRequest`): bloquea la venta; verifica que sea de la sucursal indicada; suma lo ya devuelto o
   pendiente por producto y comprueba que no se devuelva más de lo vendido (une líneas repetidas); fija el precio
   con lo **realmente pagado** (con descuentos), no el de lista. Estado `PENDIENTE`.
2. **Aprobar** (`approveRequest`, MANAGER/ADMIN): no permite aprobar sobre una venta anulada (repondría el stock dos
   veces); pasa a `APROBADA`, repone stock (sin costo, motivo DEVOLUCION) y marca la venta como `RETURNED`.
3. **Rechazar**: pasa a `RECHAZADA` con motivo.

## Historial paginado: `GET /api/v1/sales/search`

El frontend ya no baja las 18.000 ventas. Este endpoint filtra, ordena y pagina en el servidor:

- Parámetros: `page` (desde 0), `size` (máx. 100), `sortBy` (id, date, customer, seller, branchName, total, status),
  `direction`, `branchId`, `status`, `from`, `to`, `seller`, `product`, `minTotal`, `maxTotal`, `q` (texto: n.º,
  cliente, documento o vendedor, sin importar tildes ni mayúsculas).
- Responde `{content, totalElements, totalPages, completedCount, completedTotal}`: el **resumen** («N ventas
  completadas, $X») cubre todo lo filtrado, no solo la página.
- Quien no es ADMIN queda siempre limitado a su sucursal.
- `GET /api/v1/sales/filter-options` entrega los vendedores y productos para los desplegables de filtro.
- Implementación: `SalePersistenceAdapter.search` usa `Specification` (JPA Criteria): un `WHERE` dinámico según los
  filtros, un `EXISTS` para el producto y un desempate por `id` para que las páginas no repitan ni salten filas.
- `GET /api/v1/sales` (lista completa) sigue existiendo porque Reportes y Devoluciones lo usan.

## Endpoints y permisos

| Ruta | Roles |
|---|---|
| `POST /api/v1/sales`, `GET /api/v1/sales`, `…/search`, `…/filter-options`, `…/{id}` | ADMIN, MANAGER, SELLER, OPERADOR |
| `DELETE /api/v1/sales/{id}` | ADMIN, MANAGER |
| `POST /api/v1/returns` | cualquier rol de sucursal |
| `POST /api/v1/returns/{id}/approve` y `/reject`, `GET /returns/pending` | ADMIN, MANAGER |
| `GET /api/v1/returns` | ADMIN |

Una venta de otra sucursal responde 403 al que no es ADMIN.

## Con quién se relaciona

- **Usa**: `inventory` (stock), `catalog` (productos), `pricelist` (precios), `branch`, `auth` (vendedor).
- **`alert`**: `SaleService` y `ReturnRequestService` reciben `AlertUseCase` por constructor (con `@Lazy` para evitar
  un ciclo de dependencias), pero **hoy no llaman a ningún método suyo**: es una dependencia sin uso. Las alertas de
  stock bajo que provoca una venta salen por el evento de `inventory`, no por aquí.
- **Lo leen**: `analytics` (SQL sobre `ventas` y `detalles_venta`).
