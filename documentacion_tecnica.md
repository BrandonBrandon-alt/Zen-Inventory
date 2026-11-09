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
    TRANSFERENCIAS ||--o{ PAGOS_TRASLADO : "flete pagado con"
    USUARIO ||--o{ PAGOS_TRASLADO : "registra"
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
        string metodo_pago
        string referencia_pago
    }

    PAGOS_TRASLADO {
        bigint id PK
        bigint traslado_id FK
        decimal monto
        timestamp fecha
        bigint usuario_id FK
        varchar usuario_nombre
        varchar metodo
        varchar referencia
        text notas
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
        +SalePaymentMethod paymentMethod
        +String paymentReference
        +BigDecimal globalDiscountPercentage
        +create() Sale
        +cancel(reason)
        +markAsReturned()
        +effectiveUnitPaid(line) BigDecimal
        +findLine(saleDetailId) Optional~SaleDetail~
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
    class SalePaymentMethod {
        <<enumeration>>
        EFECTIVO
        TARJETA
        TRANSFERENCIA
        OTRO
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
    Sale --> SalePaymentMethod
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
        +registerFreightPayment(monto, método, referencia)
        +freightPaid() BigDecimal
        +freightBalance() BigDecimal
        +freightPaymentStatus() FreightPaymentStatus
    }
    class TransferPayment {
        +BigDecimal amount
        +LocalDateTime date
        +String userName
        +TransferPaymentMethod method
        +String reference
        +String notes
    }
    class FreightPaymentStatus {
        <<enumeration>>
        SIN_COSTO
        POR_PAGAR
        PAGO_PARCIAL
        PAGADO
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
    Transfer "1" *-- "0..*" TransferPayment : pagos del flete
    Transfer --> FreightPaymentStatus
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
    S->>S: Sale.create() exige la forma de pago y calcula subtotal, descuentos y total
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

---

## 7. Analítica y reportes (Componente 4)

### 7.1 Indicadores por sucursal

El módulo `analytics` del backend es de **solo lectura**: no tiene tablas propias y calcula los números con SQL directo
(`JdbcTemplate`) sobre `ventas`, `detalles_venta`, `inventario_local`, `producto`, `sucursal` y `transferencias`.
Todos los endpoints viven en `/api/v1/analytics/…` y aceptan `branchId`; quien no es ADMIN queda limitado a su propia
sucursal (`CurrentUser`), así que el mismo panel sirve para la empresa entera o para una sede.

| Indicador | Endpoint | Cómo se calcula |
|---|---|---|
| Ventas del periodo | `global-summary`, `branch-performance` | Suma de `total_final` de las ventas `COMPLETED` en el rango de fechas, por sucursal. El total de una venta no se multiplica por sus líneas |
| Tendencia | `sales-trend`, `monthly-sales` | Serie diaria y comparativa de los últimos 6 meses (nombres de mes en español) |
| Más vendidos | `top-products` | Unidades vendidas por producto en el periodo |
| Valor del inventario | `valuations` | `cantidad_actual × costo_promedio` por sucursal |
| **Rotación** | `inventory-rotation` | `unidades vendidas ÷ existencia actual` por producto y sucursal. Solo cuenta ventas `COMPLETED` **de la misma sucursal** que la fila de stock. Un producto con existencias y sin ventas es *inventario sin movimiento*, con los días que lleva quieto |
| **Reabastecimiento** | `replenishment-insights` | Productos con `cantidad_actual ≤ 1,5 × stock_mínimo`. Prioridad ALTA si está en o bajo el mínimo y MEDIA hasta 1,5 veces el mínimo. Se ordena del más urgente (menor existencia/mínimo) al menos urgente |
| Traslados en curso | `transfers-impact` | Cantidad y valor (a costo promedio) de lo que está en tránsito |

En el frontend todo se ve en el **Panel** (`/dashboard`): tarjetas «Por atender» (reabastecimiento), «Más vendidos»,
«Por sede», «Meses recientes» y «Sin movimiento» (rotación). Los vendedores entran al panel sin indicadores.
**Reportes** (`/reports`) arma el cierre de caja y las ventas por vendedor, con lo cobrado por forma de pago, para
imprimir o guardar como PDF.

### 7.2 Kardex e historial de movimientos

Ningún módulo cambia el stock directamente: lo hace `InventoryService`, que bloquea la fila y deja un registro en
`movimiento_inventario` con el tipo (ingreso o retiro), el motivo (venta, compra, traslado, devolución, ajuste, merma…),
la cantidad, el **saldo resultante**, el usuario, la fecha y el documento de origen. Por eso el último saldo del kardex
coincide siempre con la existencia.

| Consulta | Endpoint | Roles |
|---|---|---|
| Kardex de un producto en una sucursal | `GET /api/v1/inventory/branches/{branchId}/products/{productId}/kardex` | Todos (sobre su sucursal) |
| Historial de movimientos | `GET /api/v1/inventory/movements` | ADMIN (todas las sucursales), MANAGER y OPERADOR (la suya) |

En **Inventario → Kardex** se filtra por uno o varios productos, por tipo, por motivo, por rango de fechas (el día
«Hasta» se incluye completo) y por texto.

### 7.3 Auditoría

**Auditoría global** (`/audit`, solo ADMIN) lista todos los movimientos de inventario del sistema con quién los hizo,
cuándo, en qué sucursal y desde qué documento, con filtros por sucursal, responsable, tipo, motivo y fechas, y el detalle
de cada movimiento. Además, cada paso de un traslado (solicitó, autorizó, despachó, recibió, resolvió) y de una compra
guarda su usuario y su fecha. La auditoría no registra acciones que no mueven stock, como los inicios de sesión.

### 7.4 Datos de demostración

`scripts/demo-data` simula, día a día y en orden cronológico, una distribuidora de materiales de construcción:
6 sucursales activas, 173 productos, 16 proveedores, 36 usuarios y 6 meses de historia (~18.000 ventas, ~2.400 compras,
~700 traslados, ~280 devoluciones, ~50.000 movimientos y las alertas de stock bajo). Como se simula en orden, los datos
respetan las reglas del sistema: el stock es la suma de sus movimientos, las compras mueven el costo promedio con la
misma fórmula del backend y una venta anulada devuelve el stock.

```bash
python3 scripts/demo-data/demo_data.py load    # local, sobre el contenedor zenvory-db (~10 s)
python3 scripts/demo-data/demo_data.py clean   # quita solo lo de la demostración
python3 scripts/demo-data/demo_data.py sql > demo.sql   # para cargarlo en Neon con psql (ver DEPLOY.md)
```

Se entra con `admin@demo.zeninventory.co` (o cualquier `nombre.apellido@demo.zeninventory.co`), contraseña `Demo-2026*`.
Los datos de demostración se reconocen por su dominio de correo y sus ids fijos, así que `clean` no toca lo demás.

---

## 8. Calidad y despliegue (Componente 5)

### 8.1 Pruebas

| Capa | Herramienta | Dónde | Qué cubre | Cantidad |
|---|---|---|---|---|
| Unitarias backend | JUnit 5, Mockito | `backend/src/test` | Servicios de dominio y reglas de negocio (stock, costo promedio, traslados, pagos, login) | 334 pruebas |
| Integración backend | Spring `@WebMvcTest`, `@JdbcTest` + Testcontainers | `backend/src/test` | Controladores con seguridad y roles; consultas SQL de analítica contra un PostgreSQL 16 real con las migraciones de Flyway | (incluidas arriba) |
| Unitarias y componentes frontend | Vitest, Testing Library | `*.spec.ts` junto a cada archivo | Componentes, páginas y servicios de Angular | 1.340 pruebas en 105 archivos (con las de MSW) |
| Integración HTTP frontend | MSW | `frontend-angular/src/testing/integration` | El cliente HTTP contra respuestas simuladas de la API | (incluidas arriba) |
| E2E | Playwright | `frontend-angular/e2e` | Navegación, login, roles, diseño adaptable, y flujos de negocio contra el backend real: venta, compra, analítica, kardex y auditoría | 43 pruebas en 11 archivos |

```bash
cd backend && ./mvnw test                     # requiere Java 21; con Docker corre también Testcontainers
cd frontend-angular && npm test               # no `ng test`: su pretest limpia la caché de Vitest
cd frontend-angular && E2E_USER=… E2E_PASSWORD=… npm run test:e2e   # con el backend en localhost:8080
```

Los flujos de `e2e/negocio` solo corren si se definen `E2E_USER` y `E2E_PASSWORD` (un ADMIN de pruebas). Sin esas
variables se saltan, para que `npm run test:e2e` funcione sin backend.

### 8.2 Integración continua

`.github/workflows/ci.yml` corre en cada pull request y en cada push a `master`, en dos trabajos en paralelo:

```mermaid
flowchart LR
    PR[Pull request / push a master] --> B[Backend: Java 21<br/>./mvnw test]
    PR --> F[Frontend: Node 24<br/>npm ci → lint → npm test → build]
    F --> P{¿El arranque supera<br/>el presupuesto de angular.json?}
    P -- sí --> X[Falla]
    P -- no --> OK[Verde]
    B --> OK
```

Una ejecución nueva de la misma rama cancela la anterior. El E2E no corre en CI porque necesita el backend real.

### 8.3 Contenedores

`docker-compose.yml` levanta todo el sistema en local:

| Servicio | Imagen | Puerto | Notas |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | Volumen `pgdata`, con healthcheck |
| `pgadmin` | `dpage/pgadmin4` | 5050 | Administración de la base |
| `backend` | `backend/Dockerfile` (multietapa: Maven → JRE 21 Alpine) | 8080 | Arranca cuando la base está sana. Flyway migra al iniciar. `TZ=America/Bogota` |
| `frontend-angular` | `frontend-angular/Dockerfile` (build de Angular → nginx) | 4200 | nginx sirve la SPA y reenvía `/api/*` al backend |

La imagen del backend limita el heap al 70 % de la memoria del contenedor y usa el recolector serial, pensado para los
~512 MB de los planes gratuitos.

### 8.4 Despliegue en la nube

```mermaid
flowchart LR
    U[Navegador] --> N[Netlify<br/>Angular estático]
    N -- "/api/* (proxy)" --> R[Render<br/>API Spring Boot en Docker]
    R --> DB[(Neon<br/>PostgreSQL)]
```

- **Neon:** PostgreSQL administrado. Se usa el host **directo**, no el `-pooler`, porque Flyway necesita sesión y
  bloqueos que PgBouncer en modo transacción no da.
- **Render:** Web Service con `backend/Dockerfile`, perfil `prod` (sin Swagger, cuentas de ejemplo desactivadas por
  `DefaultAccountsGuard`), secreto JWT propio y administrador inicial por variables de entorno.
- **Netlify:** construye `frontend-angular` y, con `netlify.toml`, reenvía `/api/*` a Render (el navegador solo habla
  con un dominio) y manda las demás rutas a `index.html` para que las resuelva Angular.

Pasos, variables y lista de comprobación en `DEPLOY.md`. Limitación del plan gratuito: Render duerme la API tras
~15 minutos sin tráfico, y el primer request después tarda entre 30 y 90 s. Para evitarlo se la llama periódicamente
(un monitor externo cada 5 minutos y, como respaldo, el workflow `keep-alive.yml` cada 10) en `GET /api/auth/login`,
que responde sin consultar la base: Render no se duerme y Neon puede apagarse cuando nadie usa la app.
