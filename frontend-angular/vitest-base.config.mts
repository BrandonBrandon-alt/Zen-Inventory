import { defineConfig } from 'vitest/config';

/**
 * Límites de la corrida de pruebas (`npm test`). Sin ellos, Vitest levanta un proceso por núcleo y, con ~800 pruebas en
 * jsdom, ocupa todos los núcleos y varios GB de RAM: en un portátil con el IDE, Docker y el navegador abiertos puede
 * congelar el equipo o hacer que el sistema cierre aplicaciones por falta de memoria.
 *
 * Con dos procesos la suite tarda algo más pero deja el equipo usable. Se puede subir en una máquina holgada:
 * `VITEST_MAX_WORKERS=4 npm test`.
 */
const workers = Number(process.env['VITEST_MAX_WORKERS']) || 2;

export default defineConfig({
  test: {
    maxWorkers: workers,
    minWorkers: 1,
    // Cada proceso de prueba reinicia su memoria al terminar un archivo de pruebas muy pesado, en vez de acumularla.
    execArgv: ['--max-old-space-size=1536'],
  },
});
