# Módulo `shared` — lo común a todos

> Para la visión global (hexagonal, tablas, flujo de una petición) lee primero `backend/ARQUITECTURA.md`.

## Qué hace

No es un módulo de negocio: es la **infraestructura transversal** que todos los demás usan. Aquí se decide **quién
eres** (seguridad), **qué pasa cuando algo falla** (errores) y **qué datos de la empresa** se imprimen en la factura.

A diferencia de los otros módulos, **no tiene `domain` ni `application`**: solo `infrastructure`, porque no tiene
reglas de negocio propias. No tiene tablas.

## Estructura

```
shared/infrastructure/
├── config/
│   └── OpenApiConfig            Configura Swagger/OpenAPI (documentación de la API; solo se abre en el perfil "dev")
├── security/
│   ├── SecurityConfig           Reglas de Spring Security: sin sesión (stateless), CSRF off, CORS por variable de
│   │                            entorno, solo POST /api/auth/login es público, BCrypt como codificador de claves
│   ├── JwtAuthenticationFilter  Se ejecuta en CADA petición: lee "Authorization: Bearer <token>", lo valida, carga al
│   │                            usuario de la BD y lo deja autenticado. Si la cuenta está desactivada → 401
│   ├── JwtService               Crea y valida tokens JWT (HS256). El token lleva email + id de usuario; el rol y la
│   │                            sucursal NO viajan en el token: se leen de la BD en cada petición
│   ├── CurrentUser              "¿Quién hace esto y en qué sucursal?". Fuente de verdad que usan controllers y
│   │                            services en vez de confiar en un userId/branchId que venga en el JSON
│   ├── RestAuthenticationEntryPoint  Responde 401 con el JSON de error estándar
│   └── RestAccessDeniedHandler       Responde 403 con el JSON de error estándar
└── web/
    ├── GlobalExceptionHandler   Convierte TODA excepción en una respuesta JSON uniforme (ver abajo)
    ├── ErrorResponse            Forma del JSON de error: código, mensaje, traza de seguimiento…
    ├── ErrorCode                Lista de códigos estables (INSUFFICIENT_STOCK, INVALID_STATE…) que el frontend usa
    ├── ErrorResponseWriter      Escribe ese JSON desde filtros (donde no llega el manejador de los controllers)
    ├── ResolutionRequest        DTO común para "motivo" en cancelar / rechazar
    └── CompanyController        GET /api/v1/company: nombre, NIT, dirección, teléfono, prefijo y pie de la factura
```

## Cómo funciona la seguridad, paso a paso

1. El frontend hace login (`POST /api/auth/login`, módulo `auth`) y recibe un JWT.
2. En cada petición siguiente manda `Authorization: Bearer <jwt>`.
3. `JwtAuthenticationFilter` valida firma y vencimiento con `JwtService`.
   Distingue `EXPIRED` de `INVALID` para que el frontend sepa si debe pedir login de nuevo.
4. Carga al `User` desde la BD (si no existe, o el correo fue reasignado a otra persona, o la cuenta está inactiva,
   el token ya no sirve).
5. Los controllers declaran `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")`: ¿puede este **rol** hacerlo?
6. Dentro del controller/servicio, `CurrentUser` responde: ¿puede **esta persona** actuar en **esta sucursal**?
   - ADMIN: ninguna sucursal fija, puede elegir cualquiera.
   - Resto: solo la suya; si pide otra → 403 (`requireBranch`, `resolveBranch`).

## Manejo de errores

`GlobalExceptionHandler` mapea excepciones a `ErrorResponse` con un `ErrorCode`:

| Situación | Código | HTTP |
|---|---|---|
| Credenciales mal / cuenta desactivada / demasiados intentos | `INVALID_CREDENTIALS` / `ACCOUNT_DISABLED` / `TOO_MANY_REQUESTS` | 401 / 401 / 429 |
| Sin token / vencido / inválido | `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | 401 |
| Sin permiso | `ACCESS_DENIED` / `FORBIDDEN_ACTION` | 403 |
| JSON o parámetros mal | `VALIDATION_FAILED`, `MALFORMED_REQUEST`… | 400 |
| No existe | `RESOURCE_NOT_FOUND` | 404 |
| Regla de negocio | `INVALID_STATE`, `INSUFFICIENT_STOCK`, `DUPLICATE_SKU`, `EMPTY_SALE`… | 409 / 422 |
| Dos personas editan a la vez | `CONCURRENT_MODIFICATION` | 409 |
| Falla del servidor | código genérico + id de seguimiento (el detalle va al log, no al cliente) | 500 |

> Importa excepciones de **todos** los módulos para traducirlas: por eso `shared` aparece "dependiendo" de los demás
> en el grafo del código. Es la única excepción aceptada a "los módulos no se conocen entre sí".

## Por qué existe `CurrentUser`

Si el backend confiara en el `userId` o `branchId` del cuerpo del JSON, cualquiera podría vender a nombre de otro o
mover stock de otra sucursal. Por eso `SaleController`, `TransferService`, etc. ignoran esos campos y usan
`CurrentUser`.

## Relación con otros módulos

- Depende de `auth` (cargar al usuario y su rol) y, solo para traducir errores, de los demás.
- Todos los módulos dependen de él (seguridad, errores, `CurrentUser`).
