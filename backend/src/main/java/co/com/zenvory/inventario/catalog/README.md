# Módulo `catalog` — Productos, proveedores y unidades de medida

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Es el **catálogo maestro**: define *qué cosas existen* en el negocio, no *cuántas hay* (eso es `inventory`).

Agrupa tres sub-áreas, cada una con su controller/use case/service:

1. **Productos** – artículos con SKU, precio de venta, costo promedio y unidad base.
2. **Proveedores** – a quién se le compra, y qué productos vende cada uno (precio pactado, plazo, preferido).
3. **Unidades de medida** – kg, unidad, caja… y las **presentaciones** de cada producto con su factor de conversión.

**No depende de ningún otro módulo**; en cambio lo usan `inventory`, `sale`, `purchase` y `alert`.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `producto` | `sku` (único), `nombre`, `costo_promedio`, `precio_venta`, `unidad_id` (unidad base), `activa` |
| `unidad_medida` | `nombre`, `abreviatura` |
| `producto_unidad` | Presentaciones de un producto: `factor_conversion`, `es_base`. Único por (producto, unidad). Ej.: base «unidad» y «caja» con factor 12 → 1 caja = 12 unidades |
| `proveedor` | `nombre`, `contacto`, `tiempo_entrega_dias` |
| `producto_proveedor` | Qué proveedor vende qué producto: `sku_proveedor`, `precio_pactado`, `tiempo_entrega_dias`, `preferido`. Único por (producto, proveedor) |

## Qué hace cada carpeta

```
catalog/
├── domain/
│   ├── model/
│   │   ├── Product               Producto (sku, nombre, costo promedio, precio, unidad, activo, proveedores)
│   │   ├── ProductUnit           Presentación de un producto (factor de conversión a la unidad base)
│   │   ├── UnitOfMeasure         Unidad de medida (nombre, abreviatura)
│   │   ├── Supplier              Proveedor
│   │   ├── SupplierSummary       Resumen de proveedor para mostrarlo dentro de un producto
│   │   └── ProductSupplierDetail Condiciones pactadas producto↔proveedor (precio, plazo, preferido)
│   └── exception/                DuplicateSku, ProductNotFound, SupplierNotFound, UnitOfMeasureNotFound
│
├── application/
│   ├── port/in/                  ProductUseCase, SupplierUseCase, UnitOfMeasureUseCase
│   ├── port/out/                 ProductRepositoryPort, SupplierRepositoryPort, UnitOfMeasureRepositoryPort
│   └── service/
│       ├── ProductService        · createProduct/updateProduct validan SKU único (solo si cambió)
│       │                         · deleteProduct = BORRADO LÓGICO (activa=false)
│       │                         · updateProduct NO pisa el costo promedio si la petición no lo trae (lo calcula
│       │                           el sistema con cada compra)
│       │                         · getProductForCostUpdate / updateAverageCost: los usa `inventory` para recalcular
│       │                           el costo promedio con la fila bloqueada
│       ├── SupplierService       CRUD de proveedores + proveedores de un producto
│       └── UnitOfMeasureService  CRUD de unidades + asignar/quitar presentaciones a un producto
│
└── infrastructure/adapter/
    ├── in/web/                   ProductController, SupplierController, UnitOfMeasureController
    │   └── dto/                  ProductRequest/Response, SupplierRequest/Response, UnitOfMeasure*, ProductUnit*…
    └── out/persistence/          ProductEntity, ProductSupplierEntity, ProductUnitEntity, SupplierEntity,
                                  UnitOfMeasureEntity + Jpa*Repository + los 3 *PersistenceAdapter
```

## Conceptos clave

### Costo promedio ponderado
Cuando llega mercancía por una compra, `inventory` recalcula el costo del producto:

```
nuevo = (costo_actual × stock_total + costo_compra × cantidad_nueva) / (stock_total + cantidad_nueva)
```

Se guarda en `producto.costo_promedio`. Por eso `ProductService` expone un método específico para actualizar **solo
el costo**: evita pisar ediciones simultáneas de precio o nombre.

### Unidad base y presentaciones
El stock siempre se guarda en la **unidad base** del producto. Si se mueve mercancía reportada en otra unidad
(«cajas»), `InventoryService` la convierte con el `factor_conversion` de `producto_unidad`.

### Borrado lógico
Un producto con historial (ventas, kardex) no se borra: se marca `activa=false`.

## Endpoints y permisos

| Ruta | Roles |
|---|---|
| `GET /api/catalog/products`, `…/{id}` | Cualquier usuario autenticado |
| `POST/PUT/DELETE /api/catalog/products…` | ADMIN |
| `GET /api/catalog/suppliers…` | Autenticados |
| `POST/PUT/DELETE /api/catalog/suppliers…` | ADMIN |
| `GET /api/catalog/suppliers/search`, `…/{id}/products` | ADMIN, MANAGER, OPERADOR_INVENTARIO |
| `GET /api/catalog/units…` | Autenticados |
| `POST/PUT/DELETE /api/catalog/units…`, presentaciones de producto | ADMIN |

## Quién lo usa

`inventory` (datos del producto, conversión de unidades, costo promedio), `sale` (nombre y precio al vender),
`purchase` (proveedor y producto al comprar), `alert` (nombre del producto en el mensaje).
