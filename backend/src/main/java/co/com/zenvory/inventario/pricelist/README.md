# Módulo `pricelist` — Listas de precios

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Permite tener **varios precios para un mismo producto** según el tipo de cliente («Minorista», «Mayorista»,
«Distribuidor»…). Cada lista contiene precios por producto. En el punto de venta se puede elegir una lista y el
precio de cada ítem sale de ahí.

Si un producto **no tiene precio** en la lista elegida, la venta usa el **precio base** del producto
(`producto.precio_venta`, del módulo `catalog`). Esa jerarquía la aplica `sale`:
**lista de la línea → lista global de la venta → precio base**.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `lista_precios` | `nombre` (único), `descripcion`, `activa` |
| `precio_por_lista` | `lista_id`, `producto_id`, `precio`. Único por (lista, producto) |

FKs: `precio_por_lista → lista_precios` y `→ producto`.

## Qué hace cada carpeta

```
pricelist/
├── domain/model/
│   ├── PriceList     Lista (id, nombre, descripción, activa)
│   └── ProductPrice  Precio de un producto en una lista
│
├── application/
│   ├── port/in/PriceListUseCase           getAllActiveLists, getPricesForList, getPriceForProduct (Optional),
│   │                                      upsertProductPrice, deleteProductPrice
│   ├── port/out/PriceListRepositoryPort   Persistencia
│   └── service/PriceListService           upsert = si ya existe el par (lista, producto) lo actualiza; si no, lo crea
│
└── infrastructure/adapter/
    ├── in/web/PriceListController         /api/v1/price-lists
    └── out/persistence/                   PriceListEntity, ProductPriceEntity, JpaPriceListRepository,
                                           JpaProductPriceRepository, PriceListPersistenceAdapter
```

No tiene excepciones propias ni DTO separados: es un módulo pequeño.

## Endpoints y permisos (`/api/v1/price-lists`)

| Ruta | Roles |
|---|---|
| `GET /` (listas activas) | ADMIN, MANAGER, SELLER |
| `GET /{listaId}/prices` | ADMIN, MANAGER, SELLER |
| `GET /{listaId}/products/{productoId}/price` | ADMIN, MANAGER, SELLER |
| `PUT /{listaId}/products/{productoId}/price` | ADMIN, MANAGER |
| `DELETE /{listaId}/products/{productoId}/price` | ADMIN, MANAGER |

El OPERADOR_INVENTARIO no tiene acceso (403): para él no hay listas y se vende al precio normal.

## Con quién se relaciona

Es independiente (no usa otros módulos). Lo usa `sale` (`PriceListUseCase.getPriceForProduct`) al registrar una venta.
