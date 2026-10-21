# Módulo `inventory` — Existencias por sucursal y kardex

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Es el **corazón del sistema**. Responde a «¿cuánto hay de este producto en esta sucursal?» y guarda el **historial de
cada movimiento** (kardex). **Ningún otro módulo toca el stock directamente**: venta, compra y traslado le piden a
este módulo que sume o reste.

Además:
- Convierte unidades (cajas → unidades).
- Recalcula el **costo promedio ponderado** del producto en cada entrada con costo.
- Maneja el stock **comprometido** (reservado por traslados).
- **Anuncia con eventos** cuando el stock baja o se recupera (los escucha `alert`).

## Tablas

| Tabla | Qué guarda |
|---|---|
| `inventario_local` | **Una fila por (sucursal, producto)** (único). `cantidad_actual`, `stock_minimo`, `stock_comprometido`, `last_updated` |
| `movimiento_inventario` | **Kardex**: una fila por cada entrada o salida. `tipo` (INGRESO/RETIRO), `motivo`, `cantidad`, `saldo_final` (cómo quedó el stock), `usuario_id`, `referencia_id` + `tipo_referencia` (a qué venta/compra/traslado corresponde), `observaciones`, `sub_motivo` |

FKs: ambas apuntan a `sucursal` y `producto`; el kardex además a `usuario`.

**Disponible = `cantidad_actual` − `stock_comprometido`.** Es lo que se compara con el mínimo y lo que se puede
vender o reservar.

## Qué hace cada carpeta

```
inventory/
├── domain/
│   ├── model/
│   │   ├── LocalInventory          Saldo de un producto en una sucursal. Métodos: availableQuantity(),
│   │   │                           hasSufficientStock(cantidad)
│   │   ├── LocalInventoryEnriched  Saldo + datos del producto (nombre, SKU) para listados
│   │   ├── InventoryMovement       Una línea del kardex
│   │   ├── MovementType            INGRESO | RETIRO  (¿sube o baja el saldo?)
│   │   └── MovementReason          VENTA, COMPRA, TRASLADO, MERMA, DEVOLUCION, AJUSTE_POSITIVO, AJUSTE_NEGATIVO (¿por qué?)
│   ├── event/
│   │   ├── StockLevelDroppedEvent   "el stock de (sucursal, producto) bajó al mínimo o menos"
│   │   └── StockLevelRestoredEvent  "el stock volvió a superar el mínimo"
│   └── exception/                  InsufficientStockException, InventoryNotFoundException
│
├── application/
│   ├── port/in/InventoryUseCase    Lo que ofrece al resto del sistema: getInventory, withdrawStock, addStock,
│   │                               reserveStock, releaseStock, updateMinimumStock, getKardex, getInventoryByBranch…
│   ├── port/out/                   LocalInventoryRepositoryPort, InventoryMovementRepositoryPort
│   └── service/InventoryService    Toda la lógica (ver abajo)
│
└── infrastructure/adapter/
    ├── in/web/InventoryController  /api/v1/inventory/…   + dto/ (StockRequest, InventoryProductResponse, InventoryConfigDTO)
    └── out/persistence/            LocalInventoryEntity, InventoryMovementEntity + sus Jpa*Repository y adaptadores
```

## Cómo trabaja `InventoryService` (lo más importante del backend)

### `withdrawStock` (restar)
1. **Bloquea la fila** de `inventario_local` (`lockedInventory`) hasta el fin de la transacción: si dos ventas
   simultáneas piden el último producto, la segunda espera y luego ve que ya no hay (evita «pérdida de actualización»).
   Si la fila no existe, la crea vacía *antes* de bloquearla.
2. **Convierte la unidad** a unidad base (`applyConversion`) si el movimiento viene en otra presentación. Una unidad
   desconocida o sin factor **falla** en lugar de adivinar.
3. Comprueba que hay stock suficiente (disponible); si no → `InsufficientStockException`.
4. Resta, y escribe una fila en `movimiento_inventario` con el `saldo_final`.
5. Si el mínimo está definido (> 0) y lo disponible quedó en/bajo él → publica `StockLevelDroppedEvent`.

### `addStock` (sumar)
Igual de bloqueado y convertido, y además:
- Si trae `unitCost`, recalcula el **costo promedio ponderado** (`updateProductAverageCost`), bloqueando también la
  fila del producto para que dos entradas simultáneas no se pisen el cálculo. Las reposiciones por anulación de
  venta/devolución llegan **sin costo** (no son compras y no deben alterar el promedio).
- Si el stock superó el mínimo → publica `StockLevelRestoredEvent`.

### `reserveStock` / `releaseStock` (traslados)
Suben o bajan `stock_comprometido` en el **origen**. Así la mercancía queda apartada mientras el traslado avanza,
aunque físicamente siga en la bodega.

### `updateMinimumStock`
Cambia el mínimo de un producto en una sucursal; si el nuevo valor deja al producto en estado crítico, avisa.

## Flujo ejemplo: una venta resta stock

```
SaleService.execute
  → InventoryUseCase.withdrawStock(branch, product, qty, unit, VENTA, userId, saleId, "VENTA", …)
  → InventoryService.withdrawStock           (bloquea fila, convierte unidad, valida, resta)
      → LocalInventoryRepositoryPort.save    UPDATE inventario_local
      → InventoryMovementRepositoryPort.save INSERT movimiento_inventario  (kardex)
      → eventPublisher.publishEvent(StockLevelDroppedEvent)   si quedó en/bajo el mínimo
  (después del commit)  AlertService.onStockLevelDropped  → INSERT alertas_stock
```

## Endpoints y permisos

| Ruta (`/api/v1/inventory/…`) | Para qué | Roles |
|---|---|---|
| `GET branches/{b}` | Inventario de una sucursal | ADMIN, MANAGER, SELLER, OPERADOR |
| `GET branches/{b}/products/{p}` | Saldo puntual | ADMIN, MANAGER, OPERADOR |
| `GET branches/{b}/availability` | Productos con existencia disponible (existencia − comprometido) y su cantidad, **sin precios ni costos**; se puede consultar la de otra sucursal. Lo usa la solicitud de traslado | ADMIN, MANAGER, OPERADOR |
| `PUT branches/{b}/products/{p}/config` | Cambiar stock mínimo | ADMIN, MANAGER |
| `GET branches/{b}/products/{p}/kardex` | Historial del producto | ADMIN, MANAGER, SELLER, OPERADOR |
| `POST …/withdraw` y `POST …/add` | Ajustes manuales de salida / entrada | ADMIN, MANAGER, OPERADOR |
| `GET movements` | Todos los movimientos | ADMIN, MANAGER, OPERADOR |

Quien no es ADMIN solo puede operar sobre su propia sucursal.

## Con quién se relaciona

- **Usa** `catalog` (`ProductUseCase`, `UnitOfMeasureUseCase`: datos del producto, factores y costo promedio).
- **Lo usan** `sale`, `purchase`, `transfer` y `alert`.
- **Publica eventos** que escucha `alert`.
