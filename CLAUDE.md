# CLAUDE.md — optiplant-prueba-tecnica

Monorepo: `backend/` (Spring Boot, Maven) y `frontend/` (Next.js, en proceso de
migración a Angular con fines de aprendizaje).

## graphify — grafo de conocimiento del código

El proyecto usa [graphify](https://pypi.org/project/graphifyy/) (skill `graphify`,
`.claude/skills/graphify/SKILL.md`) para navegar el código con un grafo en vez de
grep/lecturas masivas.

**Requisito por desarrollador:** `uv tool install graphifyy` (o `pipx install graphifyy`)
y luego `graphify update .` en la raíz para generar `graphify-out/`. La carpeta
`graphify-out/` está en `.gitignore`: cada quien la genera localmente, nunca se commitea.
`.graphifyignore` excluye archivos generados (p. ej. `frontend/src/api/schema.d.ts`).

Reglas:
- **Antes de modificar código (obligatorio):** consultar el grafo del área afectada con
  `graphify query "<qué voy a cambiar>"` y, según el caso, `graphify explain "<símbolo>"` (qué lo rodea) o
  `graphify path "<A>" "<B>"` (qué depende de qué: p. ej. de un endpoint del backend a su pantalla Angular).
  Sirve para encontrar los archivos correctos y el impacto del cambio sin leer de más. Un único grafo en la
  raíz cubre `backend/` y `frontend-angular/` (y `frontend/`), así que las relaciones entre ambos se ven.
- Para preguntas sobre el código, si existe `graphify-out/graph.json`, correr primero
  `graphify query "<pregunta>"`. Para relaciones, `graphify path "<A>" "<B>"`; para un
  concepto puntual, `graphify explain "<concepto>"`. Devuelven un subgrafo acotado,
  mucho más chico que `GRAPH_REPORT.md` o la salida cruda de grep.
- Leer `graphify-out/GRAPH_REPORT.md` solo para revisiones de arquitectura amplias o
  cuando query/path/explain no alcancen.
- Después de modificar código, correr `graphify update .` (solo AST, sin costo de API). Un hook `Stop` lo hace
  solo al terminar cada respuesta (~4 s), pero hay que correrlo a mano si se necesita el grafo al día a mitad de tarea.
- Si `graphify` no está instalado, seguir con las herramientas normales y avisar al usuario.

Automatización en `.claude/settings.json`: un hook `UserPromptSubmit` recuerda en cada prompt consultar el
grafo antes de modificar código (si existe `graphify-out/graph.json`) y un hook `Stop` corre
`graphify update .` al terminar cada respuesta para mantenerlo al día.

## frontend-angular — migración a Angular

Proyecto nuevo en `frontend-angular/` que reemplaza a `frontend/` (Next.js) pantalla por pantalla.
Spec y plan en `docs/superpowers/specs/` y `docs/superpowers/plans/`. Convenciones, estructura y
comandos: `frontend-angular/README.md`.

**Regla operativa:** al implementar o modificar algo, agregar o actualizar los tests y correr la
suite antes de dar la tarea por terminada. No se escribe un test que no pueda fallar por un bug real.

Tres capas de testing:

| Capa | Ubicación | Comando |
|---|---|---|
| Unit y componentes (Vitest) | `*.spec.ts` junto al archivo | `npm test` |
| Integración HTTP (MSW) | `src/testing/integration/` | `npm test` |
| E2E (Playwright) | `e2e/*.e2e.ts` | `npm run test:e2e` |

- Correr siempre `npm test` desde `frontend-angular/` (no `ng test` directo): su `pretest` limpia una
  caché de Vitest que puede ejecutar código fuente desactualizado y dar falsos verdes.
- El E2E **solo a pedido explícito**: los flujos de negocio necesitan el backend real en `localhost:8080`.
- Un cambio en el contrato del backend: `npm run openapi:gen` y corregir lo que deje de compilar.

## Integración continua

`.github/workflows/ci.yml` corre en cada PR y en `master`: backend (`./mvnw test`, sin base de datos) y frontend
Angular (`npm run lint`, `npm test`, `npm run build`, que falla si el arranque pasa del presupuesto de `angular.json`).
El E2E de Playwright no está en CI: necesita el backend real.
