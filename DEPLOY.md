# Despliegue gratuito: Netlify + Render + Neon

```
Navegador ──► Netlify (Angular estático)
                 └─ /api/*  ──proxy──►  Render (API Spring Boot, Docker)  ──►  Neon (PostgreSQL)
```

El navegador solo habla con Netlify: las llamadas a `/api/...` se reenvían a la API (`frontend-angular/netlify.toml`),
igual que hace nginx en Docker. Los límites de los planes gratuitos cambian: confírmalos en cada web.

## 0. Antes de empezar

- **Cuentas de ejemplo:** la migración V2 crea `admin@zeninventory.co` (`admin123`) y otras dos con contraseñas
  públicas. Fuera del perfil `dev` la API las **desactiva al arrancar** (`DefaultAccountsGuard`). Para entrar define
  `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` (mínimo 12 caracteres): se crea ese administrador.
- Los usuarios de la demostración (`*@demo.zeninventory.co`, contraseña `Demo-2026*`) también tienen contraseña
  pública: úsalos solo si la demo puede ser abierta, o cambia sus contraseñas después de cargarla.

## 1. Base de datos: Neon

1. Crea un proyecto en <https://neon.tech> (PostgreSQL 16 o superior) y una base, por ejemplo `inventario`.
2. Copia los datos de conexión: **host**, **base**, **usuario** y **contraseña**. La URL JDBC es:
   `jdbc:postgresql://<host>/<base>?sslmode=require`
3. Flyway crea el esquema solo la primera vez que arranca la API (no hace falta ejecutar nada a mano).

## 2. API: Render

1. En <https://render.com> crea un **Web Service** desde tu repositorio de GitHub.
2. Ajustes: **Language: Docker**, **Root Directory: `backend`**, plan **Free**.
3. Variables de entorno:

| Variable | Valor |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (**nunca** `dev`: abre Swagger y registra SQL) |
| `SPRING_DATASOURCE_URL` | la URL JDBC de Neon |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | los de Neon |
| `SECURITY_JWT_SECRET` | una cadena aleatoria larga (≥ 48 caracteres; p. ej. `openssl rand -base64 48`) |
| `CORS_ALLOWED_ORIGINS` | la URL de tu sitio en Netlify, p. ej. `https://tu-sitio.netlify.app` |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | tu administrador (contraseña de ≥ 12 caracteres) |
| `COMPANY_NAME`, `COMPANY_TAX_ID`… | opcionales: datos de la factura |

   `CORS_ALLOWED_ORIGINS` es necesario aunque haya proxy: Netlify reenvía la cabecera `Origin` del navegador, y la
   API la rechazaría si no reconoce ese origen.
4. Despliega. Al primer arranque Flyway crea las tablas (tarda un poco más). Anota la URL: `https://<servicio>.onrender.com`.

> El plan gratuito **se duerme tras ~15 minutos sin tráfico** y el primer request tarda 30–90 s. Abre la app un minuto
> antes de una demostración.

## 3. Frontend: Netlify

1. En `frontend-angular/netlify.toml` cambia `https://TU-API.onrender.com` por la URL de Render y haz commit.
2. En <https://netlify.com> elige **Add new site → Import from Git** con el mismo repositorio y pon
   **Base directory: `frontend-angular`**. Netlify lee ahí `netlify.toml` (comando de build, carpeta de salida y
   redirecciones).
3. Despliega y copia la URL del sitio; ponla en `CORS_ALLOWED_ORIGINS` en Render (paso 2) y vuelve a desplegar la API.

## 4. Datos de demostración (opcional)

Genera el SQL (no toca ninguna base) y cárgalo en Neon con `psql`:

```bash
python3 scripts/demo-data/demo_data.py sql > demo.sql
psql "postgresql://<usuario>:<contraseña>@<host>/<base>?sslmode=require" -f demo.sql
```

Hazlo **después** del primer arranque de la API (cuando Flyway ya creó las tablas). Son ~18.000 ventas; caben en los
0,5 GB del plan gratuito. Más detalle en `scripts/demo-data/README.md`.

## 5. Lista de comprobación

- [ ] `SPRING_PROFILES_ACTIVE=prod` y `SECURITY_JWT_SECRET` propio en Render.
- [ ] Entras con tu administrador inicial; `admin@zeninventory.co` / `admin123` ya **no** funciona.
- [ ] `https://<servicio>.onrender.com/swagger-ui.html` responde 401/403 (no abre la documentación).
- [ ] Las contraseñas de la demostración cambiadas, o demo conscientemente pública.
- [ ] La URL de Render en `netlify.toml` y la de Netlify en `CORS_ALLOWED_ORIGINS`.

## Alternativa: una sola máquina (Oracle Cloud Always Free)

Una VM con Docker corre el `docker-compose.yml` casi tal cual, sin dormirse. Pone un proxy con HTTPS (p. ej. Caddy)
delante de nginx, usa `SPRING_PROFILES_ACTIVE=prod`, cierra el puerto de PostgreSQL y define las mismas variables de la
tabla del paso 2.
