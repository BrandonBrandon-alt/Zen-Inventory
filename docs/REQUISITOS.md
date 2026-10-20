# Levantamiento de Requisitos: Zen Inventory (OptiPlant)

## 0. Cómo se elaboró este documento

Este levantamiento **se hizo sobre el sistema ya construido**, no antes de construirlo. No proviene de entrevistas con
un cliente real: lo desarrolla una sola persona (Brandon Montealegre) como proyecto final de Administración de
Proyectos, Universidad del Quindío.

Los requisitos se **dedujeron y verificaron contra las fuentes del propio proyecto**:

| Fuente | Qué aportó |
|---|---|
| Código del backend (`backend/src/main/java/.../inventario/*`) y su `README.md` por módulo | Reglas de negocio, estados, permisos por rol y endpoints |
| Migraciones Flyway (`V1`–`V4`) | Modelo de datos |
| Menú y rutas del frontend (`frontend-angular/src/app/layout/nav-items.ts`) | Pantallas y qué rol accede a cada una |
| `README.md`, `documentacion_tecnica.md`, `backend/ARQUITECTURA.md` | Visión general, flujos y arquitectura |
| Pruebas automatizadas (backend, Vitest, MSW, Playwright) | Comportamientos comprobados |

Cada requisito indica su **estado**. Todos los de las secciones 3 a 5 están **implementados**; lo que no lo está se
declara en la sección 8.

## 1. Propósito y alcance

**Problema que atiende:** una empresa con varias sucursales necesita saber cuánto stock tiene cada una, venderlo sin
errores, mover mercancía entre sedes, comprarle a proveedores y enterarse a tiempo de lo que se está agotando, todo con
trazabilidad de quién hizo cada operación.

**Alcance:** sistema web (API REST + aplicación Angular) para gestión de inventario multisucursal: catálogo, existencias
y kardex, ventas y devoluciones, traslados, compras, alertas de stock, analítica y administración de usuarios.

**Fuera de alcance:** contabilidad, facturación electrónica ante la DIAN, pasarelas de pago, comercio electrónico,
aplicación móvil nativa (la web es adaptable a móvil).

## 2. Actores y roles

| Rol | Descripción | Alcance |
|---|---|---|
| **ADMIN** | Administra todo el sistema | Todas las sucursales; no pertenece a una |
| **MANAGER** (Gerente) | Gestiona una sucursal | Solo su sucursal |
| **SELLER** (Vendedor) | Atiende el punto de venta | Solo su sucursal |
| **OPERADOR_INVENTARIO** | Maneja stock, compras y traslados | Solo su sucursal |

Todo rol distinto de ADMIN pertenece a exactamente una sucursal.

## 3. Requisitos funcionales

Prioridad: **A** = esencial para el funcionamiento, **M** = importante, **B** = complementario.

### 3.1 Autenticación y usuarios

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-01 | El sistema debe permitir iniciar sesión con correo y contraseña y entregar un token de sesión | Todos | A | Implementado |
| RF-02 | El sistema debe permitir crear, editar, consultar y desactivar usuarios, asignando rol y sucursal | ADMIN, MANAGER | A | Implementado |
| RF-03 | Un MANAGER solo debe gestionar usuarios de su sucursal y de rol inferior (vendedor, operador) | MANAGER | A | Implementado |
| RF-04 | «Eliminar» un usuario debe desactivarlo, conservando su historial | ADMIN, MANAGER | M | Implementado |
| RF-05 | Cada usuario debe poder cambiar su nombre, su contraseña y su foto de perfil | Todos | B | Implementado |

### 3.2 Sucursales

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-06 | El sistema debe permitir crear, editar, consultar y desactivar sucursales | ADMIN (consulta: todos) | A | Implementado |

### 3.3 Catálogo

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-07 | Gestionar productos con SKU único, nombre, precio de venta, costo promedio y unidad base | ADMIN | A | Implementado |
| RF-08 | Gestionar proveedores y, por cada producto, qué proveedores lo venden con precio pactado, plazo de entrega y proveedor preferido | ADMIN | A | Implementado |
| RF-09 | Gestionar unidades de medida y presentaciones de un producto con su factor de conversión a la unidad base | ADMIN | M | Implementado |
| RF-10 | Gestionar listas de precios (p. ej. minorista, mayorista) con un precio por producto | ADMIN, MANAGER (consulta también SELLER) | M | Implementado |
| RF-11 | Un producto con historial no se borra: se desactiva y deja de poder venderse | ADMIN | M | Implementado |

### 3.4 Inventario y kardex

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-12 | Consultar las existencias de cada producto por sucursal (cantidad actual, comprometida y disponible) | Todos | A | Implementado |
| RF-13 | Registrar cada entrada o salida de stock como movimiento (kardex) con tipo, motivo, cantidad, saldo resultante, usuario y documento de origen | Sistema | A | Implementado |
| RF-14 | Consultar el kardex de un producto en una sucursal | Todos | A | Implementado |
| RF-15 | Permitir ajustes manuales de entrada o salida (merma, ajuste positivo o negativo) | ADMIN, MANAGER, OPERADOR | M | Implementado |
| RF-16 | Definir el stock mínimo de un producto por sucursal | ADMIN, MANAGER | A | Implementado |
| RF-17 | Convertir automáticamente a la unidad base los movimientos hechos en otra presentación | Sistema | M | Implementado |
| RF-18 | Recalcular el costo promedio ponderado de un producto en cada entrada por compra | Sistema | M | Implementado |

### 3.5 Ventas y devoluciones

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-19 | Registrar una venta en el punto de venta con varios productos, descuento por línea y descuento global, cliente opcional y lista de precios | Todos | A | Implementado |
| RF-20 | Resolver el precio de cada línea así: lista de la línea, luego lista global de la venta, luego precio base | Sistema | A | Implementado |
| RF-21 | No permitir una venta si algún producto no tiene stock disponible suficiente, sin guardar nada | Sistema | A | Implementado |
| RF-22 | Descontar el stock al vender y dejar el movimiento en el kardex | Sistema | A | Implementado |
| RF-23 | Consultar el historial de ventas con paginación en el servidor, orden y filtros (fecha, estado, vendedor, producto, rango de total, proveedor, con descuento, cliente registrado, texto libre) y un resumen de lo filtrado | Todos | A | Implementado |
| RF-24 | Anular una venta con un motivo obligatorio, devolviendo el stock | ADMIN, MANAGER | A | Implementado |
| RF-25 | Imprimir la factura de una venta | Todos | M | Implementado |
| RF-26 | Solicitar la devolución de productos de una venta sin exceder lo vendido, valorada al precio realmente pagado | Todos | A | Implementado |
| RF-27 | Aprobar o rechazar devoluciones; al aprobar, el stock vuelve a la sucursal | ADMIN, MANAGER | A | Implementado |

### 3.6 Traslados entre sucursales

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-28 | Solicitar un traslado de mercancía desde otra sucursal, reservando el stock en el origen | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-29 | Llevar el traslado por los estados PENDING, APPROVED_DEST, PREPARING, IN_TRANSIT, DELIVERED, WITH_ISSUE, UNDER_CLAIM, CANCELLED y REJECTED, rechazando transiciones inválidas | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-30 | Al despachar, retirar el stock del origen y registrar transportista, número de guía y costo de envío | Sucursal origen | A | Implementado |
| RF-31 | Al recibir, ingresar al destino lo realmente recibido y marcar novedad si hubo faltantes | Sucursal destino | A | Implementado |
| RF-32 | Resolver una novedad como merma, reenvío de lo faltante o reclamo al transportista | ADMIN, MANAGER | M | Implementado |
| RF-33 | Cancelar o rechazar un traslado con motivo; si ya iba en tránsito, la mercancía vuelve al origen | ADMIN, MANAGER | M | Implementado |
| RF-34 | Registrar quién ejecutó cada paso del traslado | Sistema | M | Implementado |
| RF-35 | Reporte de cumplimiento y analítica logística de traslados | ADMIN, MANAGER, OPERADOR | B | Implementado |

### 3.7 Compras a proveedores

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-36 | Crear una orden de compra a un proveedor con productos, cantidades, precio pactado y descuento | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-37 | Si la crea un operador, debe quedar en espera de aprobación; si la crea un gerente o administrador, nace aprobada | Sistema | M | Implementado |
| RF-38 | Llevar la recepción por AWAITING_APPROVAL, PENDING, IN_TRANSIT, RECEIVED_PARTIAL, RECEIVED_TOTAL y CANCELLED | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-39 | Recibir mercancía total o parcialmente, sumando el stock y recalculando el costo promedio | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-40 | Cerrar una orden con faltantes definitivos | ADMIN | B | Implementado |
| RF-41 | Llevar el estado de pago por separado (POR_PAGAR, PAGO_PARCIAL, PAGADO), deducido de los pagos registrados; solo se paga una orden ya recibida | ADMIN, MANAGER | M | Implementado |
| RF-56 | Registrar cada pago o abono a un proveedor con monto, fecha, usuario, método (efectivo, transferencia, cheque, tarjeta u otro) y referencia, sin poder exceder el saldo, y conservar el historial de pagos de la orden | ADMIN, MANAGER | A | Implementado |
| RF-57 | Mostrar el saldo pendiente de cada orden, marcar las vencidas y resumir cuánto se debe a proveedores | Todos los que ven compras | M | Implementado |
| RF-42 | Cancelar una orden con motivo | ADMIN, MANAGER | M | Implementado |

### 3.8 Alertas de stock

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-43 | Generar una alerta cuando el stock disponible de un producto llega o baja del mínimo, sin duplicar alertas abiertas | Sistema | A | Implementado |
| RF-44 | Revisar periódicamente todo el inventario (cada 5 minutos) por si algún aviso se perdió | Sistema | M | Implementado |
| RF-45 | Cerrar solas las alertas cuando el stock se recupera por encima del mínimo | Sistema | M | Implementado |
| RF-46 | Resolver una alerta creando un traslado, creando una orden de compra o descartándola con motivo, sin que un doble clic genere dos documentos | ADMIN, MANAGER, OPERADOR | A | Implementado |
| RF-47 | Mostrar en el panel lo que «necesita atención» y permitir gestionarlo desde ahí | ADMIN, MANAGER, OPERADOR | M | Implementado |

### 3.9 Analítica y reportes

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-48 | Panel con totales de ventas, productos más vendidos, valor del inventario por sucursal, desempeño por sucursal y tendencia de los últimos meses (el vendedor entra al panel pero sin analítica) | ADMIN, MANAGER, OPERADOR (según su sucursal) | A | Implementado |
| RF-49 | Rotación de inventario, productos sin movimiento y sugerencias de reabastecimiento | ADMIN, MANAGER, OPERADOR | M | Implementado |
| RF-50 | Reporte de cierre de caja y de ventas por vendedor, para imprimir o guardar como PDF | ADMIN, MANAGER | M | Implementado |
| RF-51 | Consultar la auditoría global: todos los movimientos de inventario del sistema, con quién y cuándo | ADMIN | M | Implementado |

### 3.10 Interfaz

| ID | Requisito | Roles | Prio. | Estado |
|---|---|---|---|---|
| RF-52 | El menú solo debe mostrar y permitir las pantallas del rol del usuario | Todos | A | Implementado |
| RF-53 | Permitir moverse entre las pantallas con los atajos Ctrl+1 a Ctrl+9 | Todos | B | Implementado |
| RF-54 | La interfaz debe poder usarse en pantallas de móvil sin desbordarse horizontalmente | Todos | M | Implementado |
| RF-55 | Ofrecer tema claro y oscuro | Todos | B | Implementado |

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | El stock **disponible** es la cantidad actual menos la comprometida (reservada por traslados). Solo lo disponible se puede vender o reservar. |
| RN-02 | Ningún módulo cambia el stock directamente: lo hace el módulo de inventario, que bloquea la fila para que dos operaciones simultáneas no vendan la misma unidad. |
| RN-03 | El stock se guarda siempre en la unidad base del producto. |
| RN-04 | Una alerta de stock bajo solo se crea si el mínimo es mayor que 0. |
| RN-05 | Quien no es ADMIN solo ve y opera sobre su propia sucursal. El vendedor y la sucursal de una venta salen de la sesión, no del cuerpo de la petición. |
| RN-06 | Nadie puede cambiarse su propio rol ni desactivarse. Todo rol distinto de ADMIN debe tener sucursal. |
| RN-07 | Los datos que se imprimen (nombre de producto, sucursal, vendedor) se guardan como «foto» al momento de la venta, para que el historial no cambie si luego se renombran. |
| RN-08 | Una venta con devoluciones aprobadas no puede anularse, ni una anulada puede devolverse: se repondría el stock dos veces. |
| RN-09 | Reponer stock por anulación o devolución no es una compra y no modifica el costo promedio. |
| RN-10 | Despachar un traslado exige la cantidad enviada de cada producto; si todo es cero se rechaza. |
| RN-11 | Un pago a proveedor es inmutable y no puede exceder el saldo de la orden; el estado de pago se deduce de lo pagado y una orden cancelada no genera deuda. |

## 5. Requisitos no funcionales

| ID | Categoría | Requisito | Cómo se cumple |
|---|---|---|---|
| RNF-01 | Seguridad | Autenticación sin estado con JWT; solo el login es público | `SecurityConfig`, `JwtAuthenticationFilter`; el token dura 1 día |
| RNF-02 | Seguridad | Contraseñas guardadas con hash BCrypt | `PasswordEncoder` |
| RNF-03 | Seguridad | Bloquear el correo tras 5 intentos fallidos en 15 minutos (respuesta 429) | `LoginAttemptLimiter` |
| RNF-04 | Seguridad | No revelar si un correo existe midiendo tiempos de respuesta | `AuthService` compara siempre contra un hash |
| RNF-05 | Seguridad | Autorización por rol en cada endpoint y por sucursal en los datos | `@PreAuthorize`, `CurrentUser` |
| RNF-06 | Seguridad | Las cuentas de ejemplo se desactivan fuera de desarrollo | `DefaultAccountsGuard` |
| RNF-07 | Seguridad | El HTML que se imprime escapa los textos que vienen de la API | `escapeHtml` en factura y reporte |
| RNF-08 | Rendimiento | El historial de ventas no descarga todo: pagina, filtra y ordena en el servidor (máximo 100 por página) | `GET /api/v1/sales/search` |
| RNF-09 | Integridad | Cada operación de negocio es transaccional: si un paso falla, nada queda a medias | Servicios `@Transactional` |
| RNF-10 | Integridad | El esquema de base de datos se versiona y el arranque lo valida | Flyway y `ddl-auto: validate` |
| RNF-11 | Trazabilidad | Cada movimiento de stock y cada paso de traslado y compra queda con usuario y fecha | Kardex, campos de auditoría |
| RNF-12 | Mantenibilidad | Arquitectura hexagonal (dominio, aplicación, infraestructura) con un módulo por área | `backend/ARQUITECTURA.md` |
| RNF-13 | Calidad | Pruebas unitarias, de integración HTTP y E2E, e integración continua en cada PR | Vitest, MSW, Playwright, `ci.yml` |
| RNF-14 | Usabilidad | Interfaz en español, adaptable a móvil, con tema claro y oscuro | Frontend Angular |
| RNF-15 | Portabilidad | Ejecutable con Docker y desplegable en la nube | `docker-compose`, `DEPLOY.md` |
| RNF-16 | Errores | Toda falla responde con un JSON uniforme y un código estable | `GlobalExceptionHandler`, `ErrorCode` |

## 6. Restricciones

- **Tecnología:** Java con Spring Boot y PostgreSQL en el backend; Angular en el frontend.
- **Despliegue gratuito:** Netlify (frontend), Render (API) y Neon (base de datos). El plan gratuito de Render
  duerme la API tras unos 15 minutos sin uso, y el primer arranque en frío tarda alrededor de 3 minutos.
- **Plazo:** inicio el 21 de septiembre de 2026, hito del 100 % el 9 de noviembre y sustentación el 16 de noviembre.
- **Equipo:** una persona.
- **Datos:** el tratamiento de datos personales se rige por la Ley 1581 de 2012.

## 7. Supuestos

- Cada usuario pertenece a una sola sucursal.
- Una sola moneda, y los precios se manejan sin impuestos desglosados.
- El bloqueo de intentos de login está en memoria, así que vale para una sola réplica del servidor.

## 8. Lo que no está implementado

Se declara para no presentar como hecho lo que no lo está:

- La paginación en el servidor existe solo en el historial de ventas. Auditoría Global (que lista los movimientos de
  inventario), el kardex por producto y Reportes descargan todas sus filas; la auditoría las pagina en el navegador.
- No hay tablas virtualizadas.
- Los pagos de compras no se pueden anular ni editar (son inmutables); un pago equivocado no tiene todavía un contra-asiento.
- El costo de envío de los traslados se registra al despachar, pero no tiene un pago asociado.
- La exportación a CSV del historial de ventas no está disponible (se retiró al paginar en el servidor).
- No hay mecanismo que mantenga despierta la API gratuita de Render.
- La auditoría solo registra movimientos de inventario, no cualquier acción del sistema (por ejemplo, no registra inicios de sesión).

## 9. Trazabilidad con las pantallas

| Pantalla (ruta) | Roles | Requisitos |
|---|---|---|
| Panel (`/dashboard`) | Todos | RF-47, RF-48 |
| Inventario (`/inventory`) | Todos | RF-12 a RF-18 |
| Alertas (`/alerts`) | ADMIN, MANAGER, OPERADOR | RF-43 a RF-46 |
| Traslados (`/transfers`) | ADMIN, MANAGER, OPERADOR | RF-28 a RF-35 |
| Compras (`/purchases`) | ADMIN, MANAGER, OPERADOR | RF-36 a RF-42, RF-56, RF-57 |
| Ventas (`/sales/pos`) | Todos | RF-19 a RF-22, RF-25 |
| Historial Ventas (`/sales/history`) | Todos | RF-23, RF-24 |
| Devoluciones (`/returns`) | Todos | RF-26, RF-27 |
| Reportes (`/reports`) | ADMIN, MANAGER | RF-49, RF-50 |
| Sucursales (`/branches`) | ADMIN | RF-06 |
| Usuarios (`/users`) | ADMIN, MANAGER | RF-02 a RF-04 |
| Auditoría Global (`/audit`) | ADMIN | RF-51 |
| Productos, Proveedores, Unidades (`/catalog/*`) | ADMIN | RF-07 a RF-11 |
| Mi perfil (`/profile`) | Todos | RF-05 |
