# Módulo `purchase` — Órdenes de compra a proveedores

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Gestiona el ciclo completo de **comprarle mercancía a un proveedor**: crear la orden, aprobarla, despacharla, recibir
la mercancía (total o parcial, lo que **sube el stock** y **recalcula el costo promedio**), pagarla o cancelarla.

Maneja **dos estados independientes** en la misma orden: el de **recepción** (¿llegó la mercancía?) y el de **pago**
(¿se le pagó al proveedor?).

## Tablas

| Tabla | Qué guarda |
|---|---|
| `ordenes_compra` | `proveedor_id`, `sucursal_id` (destino), `usuario_id` (quien la creó), `usuario_recepcion_id`, `estado_recepcion`, `estado_pago`, `total`, `fecha_solicitud`, `fecha_estimada_llegada`, `fecha_real_llegada`, `tiempo_entrega_dias`, `plazo_pago_dias`, `fecha_vencimiento_pago`, `excepcion_aprobada`, datos de resolución (`motivo_resolucion`, `resuelto_por_id`, `fecha_resolucion`) y `version` (control de concurrencia optimista) |
| `detalles_orden_compra` | `producto_id`, `cantidad`, `precio_unitario_pactado`, `descuento_pct`, `subtotal`, `cantidad_recibida` |
| `pagos_orden_compra` | **Un pago o abono por fila** (migración V5): `orden_id`, `monto`, `fecha`, `usuario_id` + `usuario_nombre` (quién lo registró), `metodo`, `referencia` (n.º de transferencia, cheque o comprobante) y `notas`. Es inmutable: un pago equivocado no se edita |

FKs: `ordenes_compra → proveedor, sucursal, usuario (×3)`; `detalles_orden_compra → ordenes_compra (cascada), producto`; `pagos_orden_compra → ordenes_compra, usuario`.

## Estados

**Recepción (`ReceptionStatus`):**

```
 AWAITING_APPROVAL ──approve──► PENDING ──dispatch──► IN_TRANSIT ──receive──► RECEIVED_PARTIAL ──receive──► RECEIVED_TOTAL
        │                          │                      │                        │
        └──────────── cancel ──────┴────── cancel ────────┘                        └──close-shortfall (ADMIN)──► RECEIVED_TOTAL
                         ▼
                    CANCELLED          (también se puede recibir directo desde PENDING)
```

- Si crea la orden un **MANAGER o ADMIN** nace en `PENDING` (ya aprobada). Si la crea otro rol (p. ej. OPERADOR)
  nace en `AWAITING_APPROVAL` y necesita aprobación.
- `RECEIVED_PARTIAL`: llegó parte; sigue admitiendo recepciones hasta completar.
- `close-shortfall`: el ADMIN da por cerrada una orden con faltantes definitivos.

**Pago (`PaymentStatus`):** `POR_PAGAR` → `PAGO_PARCIAL` → `PAGADO`. El estado **se deduce de los pagos registrados**:
cada abono suma, queda `PAGO_PARCIAL` mientras haya saldo y `PAGADO` cuando lo pagado cubre el total.

Reglas del pago (`PurchaseOrder.registerPayment`):
- Solo se paga una orden ya recibida (total o parcialmente).
- El monto debe ser mayor que cero y **no puede exceder el saldo**; sin monto se paga todo el saldo.
- Cada pago guarda monto, fecha, quién lo hizo, método (`EFECTIVO`, `TRANSFERENCIA`, `CHEQUE`, `TARJETA`, `OTRO`) y referencia.
- **Saldo** = total − pagado (cero si la orden está cancelada). Una orden está **vencida** si tiene saldo y ya pasó
  `fecha_vencimiento_pago`.
- Las órdenes que ya estaban pagadas antes de V5 recibieron un pago por el total («Pago anterior al registro de pagos»).
  Las que figuraban como «pago parcial» sin ningún pago volvieron a «por pagar», porque no consta cuánto se abonó.

## Qué hace cada carpeta

```
purchase/
├── domain/
│   ├── model/
│   │   ├── PurchaseOrder        Agregado raíz: create, approve, approveException, markAsInTransit, receive,
│   │   │                        closeShortfall, cancel, registerPayment (paidAmount, balance, isOverdue). CADA método valida el estado de origen y
│   │   │                        lanza InvalidPurchaseStateException si no corresponde
│   │   ├── PurchaseOrderDetail  Línea: cantidad pedida/recibida, precio, descuento, subtotal
│   │   ├── PurchasePayment      Un pago o abono (monto, fecha, quién, método, referencia). Inmutable
│   │   ├── PaymentMethod        EFECTIVO | TRANSFERENCIA | CHEQUE | TARJETA | OTRO
│   │   ├── ReceptionStatus      Estado logístico
│   │   └── PaymentStatus        Estado financiero
│   └── exception/InvalidPurchaseStateException
│
├── application/
│   ├── port/in/
│   │   ├── PurchaseUseCase        Operaciones del módulo
│   │   ├── CreatePurchaseCommand  Datos de entrada para crear (proveedor, sucursal, ítems, plazos)
│   │   └── PurchaseReceiptResult  Resultado de una recepción (cuánto entró, costo anterior vs nuevo)
│   ├── port/out/PurchaseRepositoryPort
│   └── service/PurchaseService    Orquesta (ver abajo)
│
└── infrastructure/adapter/
    ├── in/web/  PurchaseController (/api/v1/purchases) + PurchaseRequest, PurchaseResponse, ReceiveOrderRequest,
    │            PurchaseReceiptResponse
    └── out/persistence/  PurchaseOrderEntity, PurchaseDetailEntity, JpaPurchaseRepository, PurchasePersistenceAdapter
```

## Lo importante: la recepción (`receiveOrder`)

1. **Valida todo antes de mover stock** (`requireValidReceipt`, `requireReceivable`): la orden debe estar aprobada;
   las cantidades no pueden ser negativas; al menos una línea con cantidad; **no se recibe más de lo pedido**;
   no se admiten unidades alternas (la cantidad pedida y recibida van en unidad base).
2. Captura el **costo promedio anterior** del producto (para auditar el impacto).
3. Llama a `InventoryUseCase.addStock(..., unitCost, …)`: sube `inventario_local`, escribe el kardex con motivo
   `COMPRA` y **recalcula el costo promedio ponderado**.
4. Captura el nuevo costo promedio.
5. Decide `RECEIVED_TOTAL` o `RECEIVED_PARTIAL` según lo **acumulado de todas las recepciones** (no solo esta entrega).
6. Devuelve un `PurchaseReceiptResult`.

Se hace todo en una transacción: si falla el ingreso a inventario, la orden no cambia de estado.

## Endpoints y permisos (`/api/v1/purchases`)

| Ruta | Para qué | Roles |
|---|---|---|
| `POST /` | Crear orden | ADMIN, MANAGER, OPERADOR |
| `POST /{id}/approve` | Aprobar (AWAITING_APPROVAL → PENDING) | ADMIN, MANAGER |
| `POST /{id}/approve-exception` | Aprobar una excepción (anomalía de la orden) | ADMIN |
| `POST /{id}/dispatch` | Marcar en tránsito | ADMIN, MANAGER |
| `POST /{id}/receive` | Recibir mercancía | ADMIN, MANAGER, OPERADOR |
| `POST /{id}/close-shortfall` | Cerrar con faltantes definitivos | ADMIN |
| `POST /{id}/pay` | Registrar un pago o abono: `{amount?, method?, reference?, notes?}` (sin cuerpo paga todo el saldo). La respuesta de la orden trae `paidAmount`, `balance`, `overdue` y la lista `payments` | ADMIN, MANAGER |
| `POST /{id}/cancel` | Cancelar (con motivo) | ADMIN, MANAGER |
| `GET /`, `GET /{id}` | Consultar | ADMIN, MANAGER, OPERADOR |

## Con quién se relaciona

- **Usa**: `inventory` (ingreso de stock y costo promedio), `catalog` (proveedor, producto), `auth`.
- **Lo usa** `alert`: al resolver una alerta de stock bajo «vía compra» crea aquí una orden (borrador) con el
  producto, la cantidad y el proveedor elegidos.
