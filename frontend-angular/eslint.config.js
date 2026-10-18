// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  // Código generado por `npm run openapi:gen`: no se lintea.
  { ignores: ['src/app/core/api/schema.d.ts'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  // Una feature solo puede depender de core y shared, nunca de otra feature.
  // El patrón relativo prohibido depende de la profundidad del archivo: `../` en la raíz de la feature,
  // `../../` en `data-access/x.ts`, `../../../` en `pages/<pagina>/<pagina>.ts`, etc. Lo que queda dentro de la
  // feature (hasta ese límite) es legítimo; lo que lo supera sale de la feature.
  ...[
    { files: 'src/app/features/*/*.ts', forbidden: '../*' },
    { files: 'src/app/features/*/*/*.ts', forbidden: '../../*' },
    { files: 'src/app/features/*/*/*/*.ts', forbidden: '../../../*' },
    { files: 'src/app/features/*/*/*/*/**/*.ts', forbidden: '../../../../*' },
  ].map(({ files, forbidden }) => ({
    files: [files],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@features/*'], message: 'Una feature no puede importar de otra feature.' },
            {
              group: [forbidden],
              message: 'Los imports relativos no pueden salir de la feature; usa @core o @shared.',
            },
          ],
        },
      ],
    },
  })),
  {
    files: ['src/app/shared/**/*.ts', 'src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*', '**/features/**'],
              message: 'shared y core no pueden depender de features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
