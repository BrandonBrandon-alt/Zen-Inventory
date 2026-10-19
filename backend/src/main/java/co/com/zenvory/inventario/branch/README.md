# Módulo `branch` — Sucursales

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Administra las **sucursales** (sedes o bodegas) de la empresa. Es el módulo más simple y un buen punto de partida
para entender el patrón hexagonal completo: un CRUD sin reglas complicadas.

Casi todo el sistema depende de él: cada usuario (excepto ADMIN), venta, inventario, compra, traslado y alerta
pertenece a una sucursal. **No depende de ningún otro módulo.**

## Tabla

| Tabla | Columnas principales |
|---|---|
| `sucursal` | `id`, `nombre`, `direccion`, `telefono`, `activa`, `created_at` |

Referenciada por: `usuario`, `inventario_local`, `movimiento_inventario`, `ventas`, `solicitudes_devolucion`,
`ordenes_compra`, `transferencias` (origen y destino), `alertas_stock`, `rutas_logisticas`.

## Qué hace cada carpeta

```
branch/
├── domain/
│   ├── model/Branch                       Sucursal (id, nombre, dirección, teléfono, activa, fecha). Clase simple.
│   └── exception/BranchNotFoundException  "No existe la sucursal X" → el handler global lo vuelve 404
│
├── application/
│   ├── port/in/BranchUseCase              Lo que el módulo ofrece: listar, obtener, crear, actualizar, eliminar
│   ├── port/out/BranchRepositoryPort      Lo que necesita: guardar y buscar sucursales (sin decir cómo)
│   └── service/BranchService              Implementa BranchUseCase:
│                                           · crear → la deja activa y pone la fecha actual
│                                           · eliminar → BORRADO LÓGICO (activa=false), nunca DELETE, para no romper
│                                             el historial de ventas, inventario y traslados que la referencian
│
└── infrastructure/adapter/
    ├── in/web/BranchController            Endpoints REST /api/branches
    ├── in/web/dto/BranchRequest|Response  Forma del JSON de entrada/salida
    └── out/persistence/
        ├── BranchEntity                   Clase JPA ↔ tabla `sucursal`
        ├── JpaBranchRepository            Interfaz Spring Data (genera el SQL)
        └── BranchPersistenceAdapter       Implementa BranchRepositoryPort: convierte BranchEntity ↔ Branch
```

## Flujo ejemplo: crear una sucursal

```
POST /api/branches  (solo ADMIN)
  → BranchController.create(BranchRequest)          convierte el JSON en un Branch de dominio
  → BranchUseCase.createBranch(branch)              (interfaz)
  → BranchService.createBranch                      activa=true, fecha=ahora
  → BranchRepositoryPort.save(branch)               (interfaz)
  → BranchPersistenceAdapter.save                   Branch → BranchEntity
  → JpaBranchRepository.save                        INSERT en `sucursal`
  ← BranchResponse (201)
```

## Endpoints y permisos

| Método y ruta | Roles |
|---|---|
| `POST /api/branches` | ADMIN |
| `GET /api/branches`, `GET /api/branches/{id}` | ADMIN, MANAGER, SELLER, OPERADOR_INVENTARIO |
| `PUT /api/branches/{id}` | ADMIN |
| `DELETE /api/branches/{id}` | ADMIN (borrado lógico) |

## Quién lo usa

`auth` (validar la sucursal al crear usuarios), `sale` (nombre de la sucursal en la venta), `transfer` (comprobar
que origen y destino existen y están activas), `alert` (nombre de la sucursal en el mensaje).
