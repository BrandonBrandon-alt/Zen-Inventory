# Módulo `transfer` — Traslados de mercancía entre sucursales

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Mueve productos de una sucursal (**origen**, la que tiene el stock) a otra (**destino**, la que lo necesita), con un
flujo de varios pasos y aprobaciones, y manejo de **novedades** (llegó incompleto) al recibir.

Su idea central es que el stock **no se resta de golpe**: primero se **reserva** (queda «comprometido» en origen),
luego se **despacha** (sale de verdad) y por último se **recibe** (entra al destino). Cada paso toca `inventory`.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `transferencias` | `estado`, `prioridad` (HIGH/NORMAL/LOW), `sucursal_origen_id`, `sucursal_destino_id`, `transportista`, `numero_guia`, `costo_envio`, fechas (solicitud, despacho, estimada y real de llegada), `notas_recepcion`, `parent_transfer_id` (traslado del que viene un reenvío), `version`, y la auditoría de **quién hizo cada paso**: solicitante, autorizador, despachador, recibidor, resolutor (id + nombre) |
| `detalles_transferencia` | `producto_id`, `producto_nombre`, `cantidad_solicitada`, `cantidad_enviada`, `cantidad_recibida`, `faltantes` |

FKs: origen y destino → `sucursal`; `parent_transfer_id` → `transferencias` (auto-referencia); líneas → `producto` y
`transferencias` (cascada).

## Máquina de estados (`TransferStatus`)

```
PENDING ──approve-destination──► APPROVED_DEST ──prepare──► PREPARING ──dispatch──► IN_TRANSIT ──receive──┬─► DELIVERED
   │                                                                          │                            │
   │                                                                          │                            └─► WITH_ISSUE (faltantes)
   │                                                                          │                                    │
   ├── reject (solo PENDING o IN_TRANSIT) ──► REJECTED                        │                    resolve-shrinkage ─► DELIVERED (se asume merma)
   └── cancel (PENDING, APPROVED_DEST, PREPARING, IN_TRANSIT) ──► CANCELLED   │                    resolve-resend ───► DELIVERED + NUEVO traslado por los faltantes
                                                                              │                    resolve-claim ────► UNDER_CLAIM (reclamo al transportista)
```

Cada método del dominio (`Transfer.approveDestination`, `prepare`, `dispatch`, `receive`, `cancel`, `reject`,
`resolveAsShrinkage`, `resolveAsClaim`) comprueba el estado de partida; si no coincide lanza
`InvalidTransferStateException`.

## Qué hace cada carpeta

```
transfer/
├── domain/
│   ├── model/
│   │   ├── Transfer          Agregado raíz con el flujo de estados; Transfer.resend(...) crea el traslado hijo
│   │   ├── TransferDetail    Línea (solicitada / enviada / recibida / faltante)
│   │   ├── TransferStatus    Los 9 estados
│   │   └── TransferPriority  HIGH | NORMAL | LOW
│   ├── event/TransferPreparedEvent   "el origen autorizó la salida" → lo escucha `alert`
│   └── exception/InvalidTransferStateException
│
├── application/
│   ├── port/in/   TransferUseCase + comandos: RequestTransferCommand, DispatchTransferCommand,
│   │              ReceiveTransferCommand, UpdateQuantityCommand
│   ├── port/out/TransferRepositoryPort
│   └── service/TransferService   Orquesta cada paso y habla con inventory (ver abajo)
│
└── infrastructure/adapter/
    ├── in/web/  TransferController (/api/v1/transfers), TransferRequest, TransferPrepareRequest,
    │            TransferDispatchRequest, TransferReceiveRequest, TransferResponse,
    │            TransferFulfillmentReport, LogisticsAnalyticsResponse
    └── out/persistence/  TransferEntity, TransferDetailEntity, JpaTransferRepository, TransferPersistenceAdapter
```

## Qué pasa en `inventory` en cada paso (`TransferService`)

| Paso | Efecto en el stock |
|---|---|
| **Solicitar** (`requestTransfer`) | Valida que origen y destino existan y estén **activas**, y que no se repita un producto. **Reserva** en el origen (`reserveStock`: sube `stock_comprometido`). Quien solicita pide para **su propia sucursal** (destino). Si es MANAGER/ADMIN, la aprobación de destino es automática (pasa a `APPROVED_DEST`) |
| **Aprobar destino** | Solo cambia de estado |
| **Preparar / autorizar salida** | El origen confirma cantidades. Publica `TransferPreparedEvent` (se cierran las alertas de solicitud) |
| **Despachar** | Cada producto debe traer su cantidad enviada (una línea omitida dejaría su reserva bloqueada para siempre; todo en cero se rechaza). **Libera la reserva y luego resta** del origen (en ese orden, para que la validación de stock no cuente dos veces lo reservado). Registra transportista, guía y costo de envío |
| **Recibir** | Cada línea debe traer cantidad recibida. **Suma al destino lo realmente recibido**. Si algo faltó → `WITH_ISSUE`; si no → `DELIVERED` |
| **Cancelar / rechazar** | Si aún no salió: libera la reserva. Si ya iba en tránsito: la mercancía **vuelve al origen** |
| **Resolver con reenvío** | Crea un traslado nuevo (hijo) por los faltantes y **reserva de nuevo** en el origen; el original queda `DELIVERED` |

### Quién puede ejecutar cada paso
`requireSide` distingue lados: la sucursal **origen** da el stock (prepara, despacha), la **destino** lo recibe
(aprueba, recibe), o **cualquiera de las dos** (cancelar, resolver). El **ADMIN** actúa sobre cualquier traslado.

## Endpoints y permisos (`/api/v1/transfers`)

Por defecto todo el controller exige ADMIN, MANAGER u OPERADOR_INVENTARIO; los pasos marcados restringen más.
Además `requireSide` limita por sucursal (ver arriba).

| Ruta | Para qué |
|---|---|
| `POST /` | Solicitar traslado |
| `POST /{id}/approve-destination` | Aprobar en destino (ADMIN, MANAGER) |
| `POST /{id}/prepare` | Autorizar salida (ADMIN, MANAGER) |
| `POST /{id}/dispatch` | Despachar (la sucursal de origen) |
| `POST /{id}/receive` | Recibir (la sucursal de destino) |
| `POST /{id}/resolve-shrinkage` · `resolve-resend` · `resolve-claim` | Resolver novedades (ADMIN, MANAGER) |
| `POST /{id}/cancel` · `reject` | Cancelar / rechazar con motivo (ADMIN, MANAGER) |
| `GET /`, `GET /{id}` | Consultar (cada sucursal ve los suyos) |
| `GET /fulfillment-report` | Reporte de cumplimiento (ADMIN, MANAGER, OPERADOR) |
| `GET /analytics/logistics` | Analítica logística (ADMIN, MANAGER) |

## Con quién se relaciona

- **Usa**: `inventory` (reservar, liberar, retirar, ingresar), `branch` (validar sucursales), `catalog`, `auth`.
- **Lo usa** `alert`: al resolver una alerta «vía traslado» crea aquí la solicitud.
- **Lo lee** `analytics` (impacto de traslados activos).
- **Publica** `TransferPreparedEvent`.
