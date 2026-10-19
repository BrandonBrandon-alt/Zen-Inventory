# Módulo `alert` — Alertas de stock y su resolución

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Avisa cuando un producto **baja de su stock mínimo** en una sucursal y ayuda a **resolver** el problema de tres
maneras: pedir stock a otra sucursal (traslado), comprarlo a un proveedor (orden de compra) o descartar la alerta.

Es el módulo «director de orquesta»: **no mueve stock**, pero coordina a `inventory`, `transfer` y `purchase`.

## Tabla

| Tabla | Qué guarda |
|---|---|
| `alertas_stock` | `sucursal_id`, `producto_id`, `mensaje`, `tipo_alerta`, `fecha_alerta`, `resuelta`, `tipo_resolucion`, `referencia_id` (el traslado u orden con que se resolvió), `motivo_descarte`, `fecha_resolucion` |

FKs: `sucursal`, `producto`. (`referencia_id` es un vínculo «blando» sin FK porque apunta a `transferencias` o a
`ordenes_compra` según el caso.)

## Tipos y resoluciones

- `AlertType`: `LOW_STOCK` (bajo el mínimo), `TRANSFER_REQUEST`, `RETURN_REQUEST`, `PURCHASE_REQUEST`,
  `ISSUE_REPORTED`.
- `ResolutionType`: `TRANSFER`, `PURCHASE`, `DISMISSED`.

## Qué hace cada carpeta

```
alert/
├── domain/
│   ├── model/
│   │   ├── StockAlert       Alerta. Fábricas create(...); resolve(tipo, referencia, motivo)
│   │   └── ResolutionType   Cómo se resolvió
│   └── exception/AlertAlreadyResolvedException   No se puede resolver dos veces (→ 409 ALREADY_RESOLVED)
│
├── application/
│   ├── port/in/AlertUseCase           Operaciones: crear, listar, resolver por traslado/compra/descarte, escanear
│   ├── port/out/AlertRepositoryPort   Persistencia (incluye buscar con bloqueo)
│   └── service/AlertService           Toda la lógica (ver abajo)
│
└── infrastructure/adapter/
    ├── in/web/  AlertController (/api/v1/alerts) + StockAlertResponse
    └── out/persistence/  AlertEntity, JpaAlertRepository, AlertPersistenceAdapter
```

## Cómo se generan alertas (3 caminos)

1. **Reactivo, por eventos** — cuando `inventory` publica `StockLevelDroppedEvent` (tras una venta, traslado o cambio
   del mínimo), `AlertService.onStockLevelDropped` crea la alerta. Corre `@Async` y
   `@TransactionalEventListener(AFTER_COMMIT)`: **después** del commit y en otro hilo, para que un fallo aquí no
   deshaga la venta.
2. **Proactivo, programado** — `scanForAlerts()` con `@Scheduled` cada 5 minutos (primera ejecución a los 30 s)
   revisa todo el inventario por si algún evento se perdió. Cada elemento va en su propia transacción: un registro
   dañado no frena los demás. También hay `POST /api/v1/alerts/scan` (ADMIN) para lanzarlo a mano.
3. **Manual / de otros flujos** — `createAlert(...)` con tipo y referencia.

### Anti-duplicados
`handleLowStockCheck` crea la alerta solo si lo **disponible** (actual − comprometido) ≤ mínimo **y el mínimo es
mayor que 0**, y **si no hay ya una alerta abierta de stock bajo** para ese producto y sucursal (el candado evita
que el escaneo y el oyente creen dos a la vez). Otras alertas abiertas (solicitud de traslado, novedad…) no cuentan
como duplicado.

## Cómo se cierran alertas

- **Automáticamente**: `onStockLevelRestored` (evento de `inventory`) cierra las de stock bajo cuando lo disponible
  superó de verdad el mínimo. `onTransferPrepared` (evento de `transfer`) cierra las de «solicitud de traslado» de
  esos productos.
- **A mano** (`/api/v1/alerts/{id}/…`):

| Ruta | Qué hace | Roles |
|---|---|---|
| `PATCH /{id}/resolve` | Marcar resuelta | ADMIN, MANAGER |
| `POST /{id}/resolve/transfer` | **Crea una solicitud de traslado** desde otra sucursal (`TransferUseCase`) y vincula la alerta | ADMIN, MANAGER, OPERADOR |
| `POST /{id}/resolve/purchase` | **Crea una orden de compra** (`PurchaseUseCase`): si el producto nunca se compró su precio nace en 0 («por definir») en vez de fallar | ADMIN, MANAGER, OPERADOR |
| `POST /{id}/resolve/dismiss` | Descartar con motivo (merma, descontinuado…) | ADMIN, MANAGER |
| `GET /` | Alertas activas (de la sucursal o globales) | ADMIN, MANAGER, OPERADOR |

Antes de crear el traslado o la compra, la alerta se **bloquea y se comprueba que siga abierta**: así un doble clic
o dos gerentes a la vez no generan dos documentos.

## Flujo ejemplo: una venta deja el producto bajo el mínimo

```
SaleService → InventoryService.withdrawStock → (commit) → StockLevelDroppedEvent
   → AlertService.onStockLevelDropped (hilo aparte)
       → handleLowStockCheck: ¿disponible ≤ mínimo>0 y sin alerta abierta?  → AlertRepositoryPort.save
   → INSERT en alertas_stock  → el frontend la ve en /alerts
   → gerente: «Resolver vía traslado» → AlertService.resolveViaTransfer → TransferUseCase.requestTransfer
```

## Con quién se relaciona

- **Usa**: `inventory`, `transfer`, `purchase`, `catalog`, `branch`, `auth`.
- **Escucha eventos de**: `inventory` y `transfer`.
- `sale` recibe `AlertUseCase` por constructor pero hoy no lo invoca.
- **Permisos**: todo el controller exige ADMIN, MANAGER u OPERADOR_INVENTARIO (el SELLER no ve alertas); algunas
  rutas se restringen más, como indica la tabla.
