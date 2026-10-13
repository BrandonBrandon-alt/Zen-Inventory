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
- Para preguntas sobre el código, si existe `graphify-out/graph.json`, correr primero
  `graphify query "<pregunta>"`. Para relaciones, `graphify path "<A>" "<B>"`; para un
  concepto puntual, `graphify explain "<concepto>"`. Devuelven un subgrafo acotado,
  mucho más chico que `GRAPH_REPORT.md` o la salida cruda de grep.
- Leer `graphify-out/GRAPH_REPORT.md` solo para revisiones de arquitectura amplias o
  cuando query/path/explain no alcancen.
- Después de modificar código, correr `graphify update .` (solo AST, sin costo de API).
- Si `graphify` no está instalado, seguir con las herramientas normales y avisar al usuario.

Recordatorio automático: `.claude/settings.json` tiene un hook `UserPromptSubmit` que, en
cada prompt, recuerda usar graphify si existe `graphify-out/graph.json`.

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
