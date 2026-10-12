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
