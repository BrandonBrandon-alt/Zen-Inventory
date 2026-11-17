# Despliegue gratuito: Render + Neon

```
Navegador ──► Render Static Site (Angular)
                 └─ /api/*  ──rewrite──►  Render Web Service (API Spring Boot, Docker)  ──►  Neon (PostgreSQL)
```

El navegador solo habla con el sitio estático: las llamadas a `/api/...` se reenvían a la API (`render.yaml` en la
raíz), igual que hace nginx en Docker. Los límites de los planes gratuitos cambian: confírmalos en cada web.

> Antes el frontend iba en Netlify. Su plan gratuito cobra créditos por cada deploy a producción y, al agotarlos, deja
> de publicar hasta el siguiente ciclo. `frontend-angular/netlify.toml` sigue en el repositorio por si se vuelve a usar
> (ver «Alternativa: Netlify» al final).

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
   - **Usa el host directo, el que NO lleva `-pooler`.** El host con `-pooler` pasa por PgBouncer en modo transacción,
     que no admite lo que Flyway necesita al migrar (estado de sesión y bloqueos) y puede fallar con errores
     confusos. Lo mismo vale para `psql`/`pg_dump` al cargar los datos de demostración.
   - Neon apaga el cómputo tras ~5 minutos sin uso: la primera consulta después tarda un poco más. Es normal.
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
| `TZ` | `America/Bogota`: la zona de la empresa. En UTC, las ventas de la noche quedan con fecha del día siguiente. La imagen ya la trae por defecto; defínela solo para usar otra zona |
| `SECURITY_JWT_SECRET` | una cadena aleatoria larga (≥ 48 caracteres; p. ej. `openssl rand -base64 48`) |
| `CORS_ALLOWED_ORIGINS` | la URL del sitio estático, p. ej. `https://zen-inventory-web.onrender.com` (varias, separadas por coma) |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | tu administrador (contraseña de ≥ 12 caracteres) |
| `COMPANY_NAME`, `COMPANY_TAX_ID`… | opcionales: datos de la factura |

   `CORS_ALLOWED_ORIGINS` es necesario aunque haya proxy: si el reenvío conserva la cabecera `Origin` del navegador,
   la API la rechazaría sin reconocer ese origen.
4. Despliega. Al primer arranque Flyway crea las tablas (tarda un poco más). Anota la URL: `https://<servicio>.onrender.com`.

> El plan gratuito **se duerme tras ~15 minutos sin tráfico** y el primer request tarda 30–90 s. Para evitarlo, ver
> «Mantener despierta la API» más abajo.

## 3. Frontend: Render Static Site

1. Si tu API no se llama `zen-inventory-api`, cambia su URL en la regla `/api/*` de `render.yaml` y haz commit.
2. En <https://dashboard.render.com> elige **New → Blueprint**, conecta el mismo repositorio y la rama `BEMA_DES`.
   Render lee `render.yaml` y crea solo el sitio `zen-inventory-web` (comando de build, carpeta de salida, Node 24 y
   las reglas de reescritura); la API creada en el paso 2 no se toca.
   - Sin Blueprint, a mano: **New → Static Site**; *Build Command* `cd frontend-angular && npm ci && npm run build`;
     *Publish Directory* `frontend-angular/dist/frontend-angular/browser`; variable `NODE_VERSION=24`; y en
     *Redirects/Rewrites*, en este orden: `/api/*` → `https://<api>.onrender.com/api/*` (**Rewrite**) y
     `/*` → `/index.html` (**Rewrite**).
3. Copia la URL del sitio (`https://zen-inventory-web.onrender.com` o la que asigne Render), agrégala a
   `CORS_ALLOWED_ORIGINS` de la API (paso 2) y vuelve a desplegar la API.
4. Comprueba que entras y que una venta se registra: así se prueba el reenvío de `/api/*` con `POST` y token.

El sitio estático no se duerme (eso solo pasa con la API) y solo se reconstruye cuando cambia `frontend-angular/`.

## 4. Datos de demostración (opcional)

Genera el SQL (no toca ninguna base) y cárgalo en Neon con `psql`:

```bash
python3 scripts/demo-data/demo_data.py sql > demo.sql
psql "postgresql://<usuario>:<contraseña>@<host>/<base>?sslmode=require" -f demo.sql
```

Hazlo **después** del primer arranque de la API (cuando Flyway ya creó las tablas). Son ~18.000 ventas; caben en los
0,5 GB del plan gratuito. Más detalle en `scripts/demo-data/README.md`.

## 5. Mantener despierta la API

Render duerme el servicio gratuito tras ~15 minutos sin tráfico. Basta con llamarlo más seguido que eso. La llamada
va a `GET /api/auth/login`: responde **401** desde el filtro de seguridad **sin tocar la base**, así que despierta a
Render pero deja que Neon se apague cuando nadie usa la app (cada hora encendida gasta horas de cómputo del plan).

1. **Monitor externo (recomendado, el más puntual).** En <https://uptimerobot.com> (gratis) crea un monitor:
   - *Monitor type:* **HTTP(s)**; *URL:* `https://<servicio>.onrender.com/api/auth/login`; *Interval:* **5 minutos**.
   - Un 401 cuenta como respuesta: si el monitor lo marca como caído, en *Advanced settings* agrega 401 a los códigos
     aceptados. Lo que importa es que llegue tráfico, no el resultado.
2. **Respaldo dentro del repositorio:** `.github/workflows/keep-alive.yml` hace lo mismo cada 10 minutos desde GitHub
   Actions. Solo corre desde `master`, GitHub puede retrasarlo (a veces más de 10 minutos) y lo desactiva si el
   repositorio pasa 60 días sin actividad. Para otra URL, define la variable de repositorio `RENDER_API_URL`
   (*Settings → Secrets and variables → Actions → Variables*). Se puede lanzar a mano desde la pestaña *Actions*.

Un servicio despierto todo el mes usa ~720–744 de las 750 horas gratuitas de Render por cuenta: alcanza para uno solo.

## 6. Lista de comprobación

- [ ] `SPRING_PROFILES_ACTIVE=prod` y `SECURITY_JWT_SECRET` propio en Render.
- [ ] Entras con tu administrador inicial; `admin@zeninventory.co` / `admin123` ya **no** funciona.
- [ ] `https://<servicio>.onrender.com/swagger-ui.html` responde 401/403 (no abre la documentación).
- [ ] Las contraseñas de la demostración cambiadas, o demo conscientemente pública.
- [ ] La URL de la API en `render.yaml` y la del sitio estático en `CORS_ALLOWED_ORIGINS`.
- [ ] El monitor de UptimeRobot activo (o el workflow `keep-alive` corriendo en *Actions*).

## Alternativa: una sola máquina (Oracle Cloud Always Free)

Una VM con Docker corre el `docker-compose.yml` casi tal cual, sin dormirse. Pone un proxy con HTTPS (p. ej. Caddy)
delante de nginx, usa `SPRING_PROFILES_ACTIVE=prod`, cierra el puerto de PostgreSQL y define las mismas variables de la
tabla del paso 2.

## Alternativa: Netlify

`frontend-angular/netlify.toml` hace lo mismo que `render.yaml`: **Add new site → Import from Git**, *Base directory*
`frontend-angular`, y la URL del sitio en `CORS_ALLOWED_ORIGINS`. Cada deploy a producción gasta créditos del plan
gratuito: si no se usa, detén los builds (*Site configuration → Build & deploy → Stop builds*) para no gastarlos.
