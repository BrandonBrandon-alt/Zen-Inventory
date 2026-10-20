# Documentación Técnica Integrada: Zen Inventory (OptiPlant)

Este documento contiene los diagramas de ingeniería requeridos para la comprensión técnica del sistema de gestión de inventario multi-sucursal.

---

## 1. Diagrama de Casos de Uso
Describe los actores del sistema y sus interacciones principales con los módulos funcionales.

```mermaid
flowchart LR
    Admin(["Administrador"])
    Gerente(["Gerente de Sucursal"])
    Operador(["Operador de Inventario"])
    Vendedor(["Vendedor"])

    subgraph Catalogo["Módulo de Catálogo"]
        UC1(["Gestionar Productos y Proveedores"])
        UC2(["Configurar Listas de Precios"])
    end

    subgraph Operaciones["Módulo de Operaciones"]
        UC3(["Realizar Ventas"])
        UC4(["Solicitar Traslados"])
        UC5(["Gestionar Órdenes de Compra"])
    end

    subgraph Auditoria["Módulo de Auditoría y Alertas"]
        UC6(["Ver Alertas de Stock"])
        UC7(["Consultar Historial de Movimientos"])
    end

    Admin --- UC1
    Admin --- UC2
    Admin --- UC7

    Gerente --- UC3
    Gerente --- UC4
    Gerente --- UC5
    Gerente --- UC6

    Operador --- UC3
    Operador --- UC6
    Operador --- UC7

    Vendedor --- UC3
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
        FE[Angular App]
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
    ORDENES_COMPRA ||--o{ PAGOS_ORDEN_COMPRA : "se paga con"
    USUARIO ||--o{ PAGOS_ORDEN_COMPRA : "registra"
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

    PAGOS_ORDEN_COMPRA {
        bigint id PK
        bigint orden_id FK
        decimal monto
        timestamp fecha
        bigint usuario_id FK
        varchar usuario_nombre
        varchar metodo
        varchar referencia
        text notas
    }
    PRODUCTO_PROVEEDOR {
        bigint id PK
        bigint producto_id FK
        bigint proveedor_id FK
        decimal precio_pactado
        boolean preferido
    }
```

---

## 5. Diagramas de Clases (Modelo de Dominio)
Clases del dominio del backend (`domain/model` de cada módulo). Se omiten getters y campos de auditoría para mantenerlos legibles.

### 5.1 Ventas, devoluciones y catálogo
```mermaid
classDiagram
    class Sale {
        +Long id
        +LocalDateTime date
        +BigDecimal subtotal
        +BigDecimal totalDiscount
        +BigDecimal totalFinal
        +Long branchId
        +Long userId
        +SaleStatus status
        +String cancellationReason
        +String customerName
        +BigDecimal globalDiscountPercentage
        +create() Sale
        +cancel(reason)
        +markAsReturned()
        +effectiveUnitPaid(productId) BigDecimal
        +soldUnits(productId) int
    }
    class SaleDetail {
        +Long productId
        +String productName
        +Integer quantity
        +BigDecimal unitPriceApplied
        +BigDecimal discountPercentage
        +BigDecimal subtotalLine
        +computeSubtotal() BigDecimal
    }
    class SaleStatus {
        <<enumeration>>
        COMPLETED
        CANCELED
        RETURNED
    }
    class ReturnRequest {
        +Long saleId
        +ReturnRequestStatus status
        +approve()
        +reject()
    }
    class Product {
        +Long id
        +String sku
        +String name
        +BigDecimal averageCost
        +BigDecimal salePrice
        +Boolean active
    }
    class Supplier {
        +Long id
        +String name
        +String contact
        +Integer deliveryDays
    }
    Sale "1" *-- "1..*" SaleDetail : líneas
    Sale --> SaleStatus
    Sale "1" o-- "0..*" ReturnRequest : devoluciones
    SaleDetail --> Product : producto vendido
    Product "*" -- "*" Supplier : ProductSupplierDetail
```

### 5.2 Inventario y alertas
```mermaid
classDiagram
    class LocalInventory {
        +Long branchId
        +Long productId
        +BigDecimal currentQuantity
        +BigDecimal committedQuantity
        +BigDecimal minimumStock
        +availableQuantity() BigDecimal
        +hasSufficientStock(qty) boolean
    }
    class InventoryMovement {
        +MovementType type
        +MovementReason reason
        +BigDecimal quantity
        +BigDecimal finalBalance
        +Long referenceId
        +String referenceType
        +LocalDateTime date
    }
    class MovementType {
        <<enumeration>>
        INGRESO
        RETIRO
    }
    class MovementReason {
        <<enumeration>>
        VENTA
        COMPRA
        TRASLADO
        MERMA
        DEVOLUCION
        AJUSTE_POSITIVO
        AJUSTE_NEGATIVO
    }
    class StockAlert {
        +Long branchId
        +Long productId
        +AlertType type
        +boolean resolved
        +ResolutionType resolutionType
        +Long referenceId
        +resolve(type, refId, reason)
    }
    class Branch {
        +Long id
        +String name
    }
    class Product
    LocalInventory "*" --> "1" Branch
    LocalInventory "*" --> "1" Product
    InventoryMovement "*" --> "1" LocalInventory : kardex del producto en la sucursal
    InventoryMovement --> MovementType
    InventoryMovement --> MovementReason
    StockAlert "*" --> "1" LocalInventory : stock bajo el mínimo
```

### 5.3 Traslados y compras
```mermaid
classDiagram
    class Transfer {
        +Long originBranchId
        +Long destinationBranchId
        +TransferStatus status
        +TransferPriority priority
        +String carrier
        +String trackingNumber
        +BigDecimal shippingCost
        +Long parentTransferId
        +approveDestination()
        +prepare()
        +dispatch()
        +receive()
        +cancel()
        +reject()
        +resolveAsShrinkage()
        +resolveAsClaim()
        +resend() Transfer
    }
    class TransferDetail {
        +Long productId
        +Integer requestedQuantity
        +Integer sentQuantity
        +Integer receivedQuantity
        +Integer missingQuantity
    }
    class PurchaseOrder {
        +Long supplierId
        +Long branchId
        +ReceptionStatus receptionStatus
        +PaymentStatus paymentStatus
        +BigDecimal total
        +approve()
        +markAsInTransit()
        +receive()
        +closeShortfall()
        +cancel()
        +registerPayment(monto, método, referencia)
        +paidAmount() BigDecimal
        +balance() BigDecimal
        +isOverdue(ahora) boolean
    }
    class PurchasePayment {
        +BigDecimal amount
        +LocalDateTime date
        +String userName
        +PaymentMethod method
        +String reference
        +String notes
    }
    class PaymentMethod {
        <<enumeration>>
        EFECTIVO
        TRANSFERENCIA
        CHEQUE
        TARJETA
        OTRO
    }
    class PurchaseOrderDetail {
        +Long productId
        +BigDecimal quantity
        +BigDecimal unitPrice
        +BigDecimal discountPct
        +BigDecimal receivedQuantity
    }
    class TransferStatus {
        <<enumeration>>
        PENDING
        APPROVED_DEST
        PREPARING
        IN_TRANSIT
        DELIVERED
        WITH_ISSUE
        UNDER_CLAIM
        CANCELLED
        REJECTED
    }
    class ReceptionStatus {
        <<enumeration>>
        AWAITING_APPROVAL
        PENDING
        IN_TRANSIT
        RECEIVED_PARTIAL
        RECEIVED_TOTAL
        CANCELLED
    }
    Transfer "1" *-- "1..*" TransferDetail
    Transfer --> TransferStatus
    Transfer "0..1" --> "*" Transfer : reenvío (padre)
    PurchaseOrder "1" *-- "1..*" PurchaseOrderDetail
    PurchaseOrder "1" *-- "0..*" PurchasePayment : pagos y abonos
    PurchasePayment --> PaymentMethod
    PurchaseOrder --> ReceptionStatus
    Transfer --> Branch : origen y destino
    PurchaseOrder --> Supplier
    PurchaseOrder --> Branch
```

### 5.4 Usuarios y sucursales
```mermaid
classDiagram
    class User {
        +Long id
        +String nombre
        +String email
        +String passwordHash
        +Boolean active
        +Long sucursalId
    }
    class Role {
        +Long id
        +String nombre
    }
    class Branch {
        +Long id
        +String name
    }
    User "*" --> "1" Role : ADMIN, MANAGER, SELLER, OPERADOR_INVENTARIO
    User "*" --> "0..1" Branch : sucursal (el ADMIN no tiene)
```

---

## 6. Diagramas de Secuencia

### 6.1 Inicio de sesión (`POST /api/auth/login`)
```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend Angular
    participant C as AuthController
    participant S as AuthService
    participant L as LoginAttemptLimiter
    participant R as UserRepositoryPort
    participant J as JwtService
    U->>F: correo y contraseña
    F->>C: POST /api/auth/login
    C->>S: login(email, password)
    S->>L: checkAllowed(email)
    S->>R: findByEmail(email)
    R-->>S: usuario (o ninguno)
    S->>S: passwordEncoder.matches(contraseña, hash)
    alt credenciales inválidas
        S->>L: recordFailure(email)
        S-->>C: InvalidCredentialsException
        C-->>F: 401
    else cuenta inactiva
        S-->>C: AccountDisabledException
        C-->>F: 403
    else correcto
        S->>L: reset(email)
        S->>J: generateToken(id, email)
        J-->>S: token JWT
        S-->>C: LoginResult (token + usuario)
        C-->>F: 200 token y usuario
        F->>F: guarda la sesión y redirige al panel
    end
```

### 6.2 Registro de una venta (`POST /api/v1/sales`)
```mermaid
sequenceDiagram
    actor V as Vendedor
    participant F as Frontend (POS)
    participant C as SaleController
    participant S as SaleService
    participant P as Catálogo y Listas de precios
    participant I as InventoryService
    participant DB as PostgreSQL
    V->>F: confirma la venta
    F->>C: POST /api/v1/sales
    C->>C: CurrentUser: vendedor y sucursal salen de la sesión
    C->>S: execute(CreateSaleCommand)
    loop por cada ítem
        S->>P: producto y precio (línea, lista global o precio base)
    end
    loop pre-validación
        S->>I: getInventory(sucursal, producto)
        I-->>S: stock disponible
        Note over S: sin stock suficiente se lanza InsufficientStockException y no se guarda nada
    end
    S->>S: Sale.create() calcula subtotal, descuentos y total
    S->>DB: guarda la venta y sus líneas
    loop descuento de stock
        S->>I: withdrawStock(motivo VENTA)
        I->>DB: actualiza inventario y registra el movimiento
    end
    I-->>S: StockLevelDroppedEvent (si bajó del mínimo)
    S-->>C: venta creada
    C-->>F: 201
```

### 6.3 Alerta de stock bajo y resolución por traslado
```mermaid
sequenceDiagram
    participant I as InventoryService
    participant A as AlertService
    participant DB as PostgreSQL
    actor G as Gerente
    participant F as Frontend
    participant T as TransferService
    I-->>A: StockLevelDroppedEvent (tras confirmar la transacción, en otro hilo)
    A->>A: ¿disponible <= mínimo y no hay alerta abierta?
    A->>DB: guarda la alerta
    G->>F: abre «Por atender» y pulsa «Resolver vía traslado»
    F->>A: POST /api/v1/alerts/{id}/resolve/transfer
    A->>DB: bloquea la alerta y comprueba que siga abierta
    A->>T: requestTransfer(origen, destino, producto)
    T->>I: reserveStock en la sucursal de origen
    T-->>A: traslado creado
    A->>DB: alerta resuelta con referencia al traslado
    A-->>F: 200
```

### 6.4 Traslado entre sucursales
```mermaid
sequenceDiagram
    actor D as Sucursal destino
    actor O as Sucursal origen
    participant T as TransferService
    participant I as InventoryService
    D->>T: solicitar traslado
    T->>I: reserveStock en origen (sube stock comprometido)
    Note over T: estado PENDING (o APPROVED_DEST si lo pide un gerente)
    O->>T: prepare (autoriza la salida)
    Note over T: estado PREPARING
    O->>T: dispatch (transportista, guía, costo)
    T->>I: libera la reserva y retira el stock de origen
    Note over T: estado IN_TRANSIT
    D->>T: receive (cantidades recibidas)
    T->>I: ingresa al destino lo realmente recibido
    alt llegó completo
        Note over T: estado DELIVERED
    else faltantes
        Note over T: estado WITH_ISSUE, resolver como merma, reenvío o reclamo
    end
```
