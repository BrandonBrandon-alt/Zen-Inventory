# Módulo `auth` — Usuarios, roles, login y perfil

> Visión global y explicación de la arquitectura hexagonal: `backend/ARQUITECTURA.md`.

## Qué hace

Responde a tres preguntas:

1. **¿Quién eres?** → login con email y contraseña, que devuelve un JWT.
2. **¿Qué puedes hacer?** → roles (ADMIN, MANAGER, SELLER, OPERADOR_INVENTARIO).
3. **¿Quiénes son los usuarios?** → alta, edición y desactivación de usuarios; y el perfil propio (nombre,
   contraseña, foto).

El JWT lo **fabrica** `shared/JwtService`, pero quien decide si el login es válido es este módulo.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `rol` | Los 4 roles (`nombre` único) |
| `usuario` | `nombre`, `email` (único, es el login), `password_hash` (BCrypt), `rol_id`, `sucursal_id` (null para ADMIN), `activa`, `avatar_actualizado_en` |
| `usuario_avatar` | La foto (`contenido bytea`, `tipo_contenido`), en tabla aparte para que los listados de usuarios no arrastren los bytes |

Relaciones: `usuario.rol_id → rol`, `usuario.sucursal_id → sucursal`, `usuario_avatar.usuario_id → usuario`
(se borra en cascada).

## Qué hace cada carpeta

```
auth/
├── domain/
│   ├── model/
│   │   ├── User            Usuario (nombre, email, hash, rol, sucursal, activo, fecha de avatar). Sin Spring Security.
│   │   ├── Role            Rol (id, nombre)
│   │   ├── LoginResult     Lo que devuelve un login correcto (token + datos del usuario)
│   │   └── AvatarImage     Foto procesada (bytes + tipo)
│   └── exception/          InvalidCredentials, AccountDisabled, TooManyLoginAttempts, DuplicateEmail,
│                           UserNotFound, RoleNotFound, UnauthorizedAction  (cada una → un código HTTP en shared)
│
├── application/
│   ├── port/in/
│   │   ├── AuthUseCase        login(email, password)
│   │   ├── UserUseCase        CRUD de usuarios + roles asignables
│   │   └── ProfileUseCase     perfil propio: nombre, contraseña, foto
│   ├── port/out/
│   │   ├── UserRepositoryPort     buscar/guardar usuarios y roles (lo usan también otros módulos y shared)
│   │   ├── AvatarRepositoryPort   guardar/leer/borrar la foto
│   │   └── AvatarProcessorPort    "dame esta imagen reducida": el módulo no sabe CÓMO se procesa
│   └── service/
│       ├── AuthService        Verifica credenciales. Compara SIEMPRE contra un hash (el real o uno de relleno)
│       │                      para que el tiempo de respuesta no revele si un correo existe
│       ├── LoginAttemptLimiter Tras N fallos por correo en una ventana de tiempo lo bloquea (anti fuerza bruta;
│       │                      en memoria, vale para una sola réplica del servidor)
│       ├── UserService        Reglas de quién puede gestionar a quién (ver abajo)
│       └── ProfileService     Perfil propio: cambiar nombre/contraseña, subir/quitar foto
│
└── infrastructure/adapter/
    ├── in/web/
    │   ├── AuthController      POST /api/auth/login (público)
    │   ├── UserController      /api/users
    │   ├── RoleController      GET /api/roles (los roles que quien llama puede asignar)
    │   ├── ProfileController   /api/profile (+ /password, /avatar)
    │   ├── AvatarController    GET /api/avatars/{userId} (sirve la imagen)
    │   └── dto/                LoginRequest/Response, UserRequest/Response, ChangePasswordRequest, …
    └── out/
        ├── persistence/        UserEntity, RoleEntity, AvatarEntity + sus Jpa*Repository + UserPersistenceAdapter,
        │                       AvatarPersistenceAdapter
        └── image/ImageIoAvatarProcessor   Implementa AvatarProcessorPort con javax ImageIO: reduce la foto a 256×256
```

## Flujo ejemplo: login

```
POST /api/auth/login {email, password}
  → AuthController                          valida el JSON
  → LoginAttemptLimiter.checkAllowed        ¿correo bloqueado? → 429
  → AuthService.login
      · UserRepositoryPort.findByEmail
      · PasswordEncoder.matches(...)        BCrypt; si falla → recordFailure + InvalidCredentials (401)
      · ¿cuenta inactiva? → AccountDisabled (401)
      · JwtService.generateToken(id, email) (módulo shared)
  ← LoginResponse { token, id, nombre, email, rol, sucursalId }
```

## Reglas de negocio importantes (`UserService`)

- **ADMIN**: gestiona a todos, en cualquier sucursal.
- **MANAGER**: solo gestiona usuarios **de su sucursal** y con rol **inferior** (SELLER, OPERADOR_INVENTARIO).
  Todo usuario que crea queda en su sucursal; no puede ascender a nadie ni moverlo de sucursal.
- Nadie se cambia su propio rol ni se desactiva (evita auto-ascensos y quedarse sin administradores).
- Todo rol salvo ADMIN debe tener una sucursal válida.
- El email se guarda recortado y en minúsculas; es único.
- «Eliminar» un usuario es **desactivarlo** (`activa=false`) para conservar la trazabilidad.
- Al actualizar, si no se envía contraseña se conserva el hash actual.

## Endpoints

| Ruta | Para qué |
|---|---|
| `POST /api/auth/login` | Iniciar sesión (único endpoint público) |
| `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{id}` | Gestión de usuarios (ADMIN y MANAGER, con los alcances de arriba) |
| `GET /api/roles` | Roles que quien llama puede asignar |
| `GET/PUT /api/profile`, `PUT /api/profile/password`, `PUT/DELETE /api/profile/avatar` | Perfil propio |
| `GET /api/avatars/{userId}` | Imagen de perfil |

## Con quién se relaciona

- Usa `branch` (`BranchUseCase`) para comprobar que la sucursal existe.
- `shared` carga usuarios mediante sus repositorios; `sale`, `transfer`, `purchase`, `alert`, etc. usan
  `UserRepositoryPort` o `CurrentUser` para saber el nombre/rol/sucursal de quien actúa.
