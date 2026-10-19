# Módulo `analytics` — Reportes y tableros

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Calcula los **números del negocio** para el dashboard y los reportes: qué se vende más, cuánto vale el inventario,
cómo va cada sucursal, tendencias, rotación y reposición sugerida.

Es **solo lectura**: no tiene tablas propias ni reglas de negocio que cambien datos. Por eso no hay `domain/exception`
ni nada que escribir; el «dominio» son los objetos resultado.

## Tablas que lee

No es dueño de ninguna. Consulta con **SQL directo (`JdbcTemplate`)** estas tablas de otros módulos: `ventas`,
`detalles_venta`, `inventario_local`, `producto`, `sucursal`, `transferencias`, `detalles_transferencia`.

> Excepción deliberada a «un módulo no toca las tablas de otro»: para agregaciones (`SUM`, `AVG`, `GROUP BY`) por
> rango de fechas y sucursal, SQL directo es mucho más eficiente que pasar por JPA y por los casos de uso de cada
> módulo. A cambio, si cambia el esquema de esas tablas hay que revisar las consultas de este adaptador.

## Qué hace cada carpeta

```
analytics/
├── domain/model/            Objetos de resultado (records/clases), uno por reporte:
│   ├── DashboardAnalyticsResponse   Todo el tablero junto
│   ├── TopSellingProduct            Productos más vendidos
│   ├── BranchValuation              Valor del inventario por sucursal
│   ├── GlobalSummary                Totales consolidados (ventas, ingresos…)
│   ├── BranchPerformance            Desempeño por sucursal
│   ├── SalesTrend                   Serie temporal de ventas
│   ├── MonthlySales                 Comparativa de los últimos 6 meses
│   ├── InventoryRotation            Rotación de inventario / productos sin movimiento
│   ├── ReplenishmentInsight         Productos que conviene reabastecer
│   └── TransferImpact               Impacto de los traslados activos
│
├── application/
│   ├── port/in/AnalyticsUseCase           Un método por reporte + getDashboardData
│   ├── port/out/AnalyticsRepositoryPort   Las consultas que hace falta resolver
│   └── service/AnalyticsService           Aplica valores por defecto (p. ej. límite 5) y arma el dashboard
│                                          llamando a varios reportes
│
└── infrastructure/adapter/
    ├── in/web/AnalyticsController         /api/v1/analytics/…
    └── out/persistence/AnalyticsPersistenceAdapter   Las consultas SQL (JdbcTemplate) con filtros dinámicos
```

## Endpoints (`/api/v1/analytics/…`)

| Ruta | Devuelve |
|---|---|
| `dashboard` | Resumen completo del tablero |
| `top-products` | Productos más vendidos |
| `valuations` | Valor del stock por sucursal |
| `global-summary` | Totales del periodo |
| `branch-performance` | Comparativa entre sucursales |
| `sales-trend` | Evolución de ventas |
| `monthly-sales` | Últimos 6 meses |
| `inventory-rotation` | Rotación y productos sin movimiento |
| `replenishment-insights` | Qué reabastecer |
| `transfers-impact` | Efecto de traslados activos |

Casi todos aceptan rango de fechas (`startDate`, `endDate`) y `branchId`. Como en el resto del sistema, quien no
es ADMIN queda limitado a su sucursal (el controller usa `CurrentUser`).

## Flujo ejemplo

```
GET /api/v1/analytics/dashboard?branchId=1&startDate=…&endDate=…
  → AnalyticsController              resuelve la sucursal permitida con CurrentUser
  → AnalyticsUseCase.getDashboardData
  → AnalyticsService                  llama a 6-8 consultas del puerto y las junta
  → AnalyticsRepositoryPort           (interfaz)
  → AnalyticsPersistenceAdapter       SQL con JdbcTemplate sobre ventas / inventario_local / …
  ← DashboardAnalyticsResponse
```

## Con quién se relaciona

Usa `auth`/`shared` solo para saber quién consulta. **Nadie lo usa**: es una hoja del grafo.
