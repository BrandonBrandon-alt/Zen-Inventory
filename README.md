# Zen Inventory - ERP de Gestión de Inventarios Multi-Sucursal

Zen Inventory es una plataforma integral diseñada para la gestión logística y comercial de empresas con múltiples sedes. El sistema permite el control en tiempo real de existencias, ventas personalizadas por sede, traslados entre sucursales y procesos de compra a proveedores, todo bajo una arquitectura robusta y escalable.

---

## Características Principales

### Gestión de Inventario

- Control de stock por sucursal con sistema de alertas de stock mínimo.
- Historial detallado de movimientos (Entradas, Salidas, Ajustes, Ventas, Traslados).
- Gestión de unidades de medida y proveedores por producto.

### Ventas y Facturación (POS)

- Múltiples listas de precios (Base, Global, por Cliente/Sede).
- Aplicación de descuentos por ítem y descuentos globales.
- Cálculo de impuestos y totales centralizado en el backend.
- Registro de clientes y anulación de facturas con reversión automática de stock.

### Logística y Traslados

- Proceso de traslado entre sedes con cadena de aprobación (Sede Destino -> Sede Origen).
- Control de estados: Pendiente, En Preparación, En Tránsito, Recibido.
- Gestión de novedades en recepción (Mermas y Reclamos).

### Compras y Recepción

- Órdenes de compra a proveedores.
- Recepción de mercancía con actualización automática de Inventario y Costo Promedio Ponderado (CPP).

### Análisis y Reportes

- Dashboard con indicadores clave de rendimiento (KPIs).
- Análisis de productos más vendidos y niveles de inventario crítico.

---

## Arquitectura del Sistema

El backend está construido bajo el patrón de **Arquitectura Hexagonal (Puertos y Adaptadores)**, asegurando que la lógica de negocio esté completamente aislada de la infraestructura (Base de datos, API, etc.).

```mermaid
flowchart TB
    subgraph ClientLayer ["Capa de Cliente (Frontend)"]
        direction TB
        UI["Interfaz de Usuario\n(Next.js + React)"]
        Components["Componentes Reutilizables\n(Shadcn UI + Tailwind)"]
        Services["Servicios de Consumo API\n(Axios)"]
        UI --> Components
        Components --> Services
    end

    subgraph InfrastructureIn ["Infraestructura Perimetral"]
        LB["HAProxy / Reverse Proxy\n(Balanceo / SSL)"]
    end

    subgraph BackendLayer ["Capa de Backend (Spring Boot)"]
        direction TB
        subgraph AdaptersIn ["Adaptadores de Entrada (Inbound)"]
            REST["REST Controllers\n(Web Adapters)"]
            Security["Spring Security\n(JWT Filters)"]
        end

        subgraph Application ["Capa de Aplicación"]
            PortsIn["Puertos de Entrada\n(Interfaces UseCase)"]
            ServicesApp["Implementación de Servicios\n(Casos de Uso)"]
        end

        subgraph Domain ["Capa de Dominio (Core)"]
            Entities["Entidades de Dominio"]
            VO["Value Objects / Exceptions"]
            Logic["Reglas de Negocio"]
        end

        subgraph AdaptersOut ["Adaptadores de Salida (Outbound)"]
            PortsOut["Puertos de Salida\n(Interfaces Repository)"]
            Persistence["Persistencia\n(JPA Adapters)"]
        end

        REST --> Security
        Security --> PortsIn
        PortsIn --> ServicesApp
        ServicesApp --> Domain
        Domain --> PortsOut
        PortsOut --> Persistence
    end

    subgraph DataLayer ["Capa de Datos"]
        DB[("PostgreSQL 16\n(Persistencia Relacional)")]
        Migrations["Flyway\n(Migraciones de Esquema)"]
    end

    %% Relaciones Cross-Layer
    Services <-->|HTTPS / REST| LB
    LB <--> REST
    Persistence <-->|JDBC/Hibernate| DB
    Migrations -->|Versionado| DB

    %% Estilos
    style Domain fill:#f9f,stroke:#333,stroke-width:2px
    style Application fill:#ccf,stroke:#333,stroke-width:1px
    style BackendLayer fill:#f5f5f5,stroke:#333
```

---

## Flujos de Procesos

### 1. Flujo de Transferencia entre Sucursales

Garantiza que el movimiento de mercancía entre sedes sea autorizado por ambas partes.

```mermaid
flowchart TD
    Start([Inicio]) --> Solicitud[Un usuario solicita productos de otra sede]
    Solicitud --> Pendiente[Estado: Pendiente de Aprobación]

    Pendiente -- "Gerente de Sede Destino aprueba" --> Ap_Destino[Estado: Aprobado por Sucursal que Recibe]
    Ap_Destino -- "Gerente de Sede Origen autoriza y prepara" --> Preparacion[Estado: En Preparación para Despacho]

    Preparacion -- "Bodeguero Genera Despacho" --> Transito[Estado: Mercancía en Tránsito]

    Transito -- "Llega a la Sucursal Destino" --> Recepcion{¿La mercancía coincide?}

    Recepcion -- Sí --> Entregado[Estado: Entregado y Finalizado]
    Recepcion -- No --> Novedad[Estado: Recibido con Novedad / Faltante]

    Novedad -- "Revisión Administrativa" --> Resolucion{Resolución}
    Resolucion -- "Aceptar como Merma" --> Entregado
    Resolucion -- "Generar Reclamo" --> Reclamo[Estado: En Proceso de Reclamo]

    Pendiente & Ap_Destino & Preparacion -- "Anular Proceso" --> Cancelado[Estado: Cancelado]
    Pendiente & Transito -- "Rechazar por Sede" --> Rechazado[Estado: Rechazado]
```

### 2. Flujo de Venta (POS)

Optimizado para transacciones rápidas con validación de stock en tiempo real.

```mermaid
flowchart TD
    POS([Cajero]) --> Busqueda[Buscar Producto y Cantidad]
    Busqueda --> Precios[Cálculo Automático de Precios y Descuentos]
    Precios --> Validacion{¿Hay existencias?}

    Validacion -- No --> Alerta[Notificar Stock Insuficiente] --> Busqueda
    Validacion -- Sí --> Totales[Cálculo de Totales, IVA y Descuentos Globales]

    Totales --> Facturacion[Generar Factura y Registrar Venta]
    Facturacion --> Inventario[Descuento Automático de Stock Local]
    Inventario --> MonitorStock{¿Queda poca mercancía?}

    MonitorStock -- Sí --> AlertRep[Generar Alerta Automática de Reposición]
    MonitorStock -- No --> Fin([Venta Completada])
    AlertRep --> Fin
```

---

## Stack Tecnológico

| Componente            | Tecnología                                              |
| :-------------------- | :------------------------------------------------------ |
| **Backend**           | Java 21, Spring Boot 3.5, Spring Security, JWT          |
| **Frontend**          | Next.js 14 (App Router), React, Tailwind CSS, Shadcn UI |
| **Base de Datos**     | PostgreSQL 16                                           |
| **Persistencia**      | Spring Data JPA, Hibernate                              |
| **Migraciones**       | Flyway                                                  |
| **Documentación API** | Springdoc OpenAPI (Swagger)                             |
| **Contenerización**   | Docker, Docker Compose                                  |

---

## Instalación y Configuración

### Prerrequisitos

- Docker y Docker Compose instalados.
- Java 21+ (si se corre fuera de Docker).
- Node.js 20+ (si se corre fuera de Docker).

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/optiplant-prueba-tecnica.git
cd optiplant-prueba-tecnica
```

### 2. Ejecución con Docker (Recomendado)

Para levantar todo el ecosistema (DB, Backend, Frontend, pgAdmin):

```bash
docker-compose up --build -d
```

- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:8080/api`
- **pgAdmin:** `http://localhost:5050`

### 3. Ejecución en Modo Desarrollo (Local)

**Backend:**

```bash
cd backend
./mvnw clean spring-boot:run
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## Documentación de la API

Una vez el backend esté en ejecución, puedes acceder a la documentación interactiva en:
`http://localhost:8080/api/swagger-ui.html`

---

## Seguridad y Roles

La autenticación se maneja vía **JWT (JSON Web Tokens)**. Los roles principales definidos son:

- `ADMIN`: Acceso total al sistema.
- `MANAGER`: Gestión de sucursal y aprobaciones de compra/traslado.
- `OPERATOR`: Gestión de movimientos de bodega y despachos.
- `CASHIER`: Punto de venta y atención al cliente.
