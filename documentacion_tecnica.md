# Documentación Técnica Integrada: Zen Inventory (OptiPlant)

Este documento contiene los diagramas de ingeniería requeridos para la comprensión técnica del sistema de gestión de inventario multi-sucursal.

---

## 1. Diagrama de Casos de Uso
Describe los actores del sistema y sus interacciones principales con los módulos funcionales.

```mermaid
useCaseDiagram
    actor "Administrador" as Admin
    actor "Gerente de Sucursal" as Gerente
    actor "Operador de Inventario" as Operador

    package "Módulo de Catálogo" {
        usecase "Gestionar Productos y Proveedores" as UC1
        usecase "Configurar Listas de Precios" as UC2
    }

    package "Módulo de Operaciones" {
        usecase "Realizar Ventas" as UC3
        usecase "Solicitar Traslados" as UC4
        usecase "Gestionar Órdenes de Compra" as UC5
    }

    package "Módulo de Auditoría" {
        usecase "Ver Alertas de Stock" as UC6
        usecase "Consultar Historial de Movimientos" as UC7
    }

    Admin --> UC1
    Admin --> UC2
    Admin --> UC7
    
    Gerente --> UC3
    Gerente --> UC4
    Gerente --> UC5
    Gerente --> UC6
    
    Operador --> UC3
    Operador --> UC6
    Operador --> UC7
```

---

## 2. Diagramas de Actividades (Flujos)

### 2.1 Flujo de Venta
Proceso desde la selección de productos hasta la actualización del inventario.

```mermaid
graph TD
    A[Inicio: Cliente en Caja] --> B{Seleccionar Productos}
    B --> C[Validar Stock en Sucursal]
    C -->|No hay stock| D[Notificar Falta de Existencias]
    C -->|Stock OK| E[Aplicar Descuentos/Precios]
    E --> F[Confirmar Venta]
    F --> G[Generar Registro de Venta]
    G --> H[Descontar Inventario Real]
    H --> I[Registrar Movimiento de Inventario]
    I --> J[Fin: Entrega de Productos]
```

### 2.2 Flujo de Transferencia entre Sucursales
Proceso logístico interno para el balance de inventario.

```mermaid
graph TD
    T1[Sucursal A solicita stock] --> T2[Crear Transferencia 'PENDIENTE']
    T2 --> T3[Sucursal B recibe notificación]
    T3 --> T4[Preparar Mercancía]
    T4 --> T5[Despachar: Estado 'EN TRANSITO']
    T5 --> T6[Mercancía llega a Sucursal A]
    T6 --> T7{Verificar Cantidades}
    T7 -->|Inconsistencia| T8[Registrar Faltantes/Novedad]
    T7 -->|OK| T9[Recibir: Estado 'COMPLETADO']
    T9 --> T10[Aumentar Stock Sucursal A]
    T10 --> T11[Fin del Traslado]
```

---

## 3. Diagrama de Arquitectura
Representación de la **Arquitectura Hexagonal (Puertos y Adaptadores)** utilizada en el backend.

```mermaid
graph TB
    subgraph "Capa de Presentación (Frontend)"
        FE[Next.js App]
    end

    subgraph "Capa de Infraestructura (Adapters In)"
        API[REST Controllers]
        DTO[Request/Response DTOs]
    end

    subgraph "Capa de Aplicación (Ports)"
        UC[ProductUseCase / SaleUseCase]
        IP[Input Ports]
        OP[Output Ports]
    end

    subgraph "Capa de Dominio (Core)"
        Entities[Domain Models: Product, Sale, etc.]
        Services[Domain Services: Business Logic]
    end

    subgraph "Capa de Persistencia (Adapters Out)"
        JPA[Persistence Adapters]
        Repo[JPA Repositories]
    end

    FE -- HTTP/JSON --> API
    API --> DTO
    DTO --> IP
    IP --> UC
    UC --> Services
    Services --> Entities
    UC --> OP
    OP --> JPA
    JPA --> Repo
    Repo -- SQL --> DB[(PostgreSQL)]
```

---

## 4. Diagrama Entidad-Relación (E-R)
Modelo de datos completo con relaciones, basado en la estructura de `base.sql`.

```mermaid
erDiagram
    PRODUCTO ||--o{ PRODUCTO_PROVEEDOR : "proporcionado por"
    PROVEEDOR ||--o{ PRODUCTO_PROVEEDOR : "suministra"
    PRODUCTO ||--o{ INVENTARIO_LOCAL : "existe en"
    SUCURSAL ||--o{ INVENTARIO_LOCAL : "almacena"
    PRODUCTO ||--o{ DETALLES_VENTA : "se vende en"
    VENTAS ||--o{ DETALLES_VENTA : "contiene"
    SUCURSAL ||--o{ VENTAS : "registra"
    USUARIO ||--o{ VENTAS : "vende"
    SUCURSAL ||--o{ ORDENES_COMPRA : "solicita"
    PROVEEDOR ||--o{ ORDENES_COMPRA : "recibe"
    PRODUCTO ||--o{ DETALLES_ORDEN_COMPRA : "se pide en"
    ORDENES_COMPRA ||--o{ DETALLES_ORDEN_COMPRA : "contiene"
    PRODUCTO ||--o{ MOVIMIENTO_INVENTARIO : "registra"
    SUCURSAL ||--o{ MOVIMIENTO_INVENTARIO : "sucede en"
    ROL ||--o{ USUARIO : "tiene"
    SUCURSAL ||--o{ USUARIO : "pertenece"
    UNIDAD_MEDIDA ||--o{ PRODUCTO : "mide"

    PRODUCTO {
        bigint id PK
        string sku
        string nombre
        decimal costo_promedio
        decimal precio_venta
        boolean activa
    }

    SUCURSAL {
        bigint id PK
        string nombre
        string direccion
        boolean activa
    }

    VENTAS {
        bigint id PK
        timestamp fecha
        decimal total_final
        string estado
    }

    PRODUCTO_PROVEEDOR {
        bigint id PK
        bigint producto_id FK
        bigint proveedor_id FK
        decimal precio_pactado
        boolean preferido
    }
```
