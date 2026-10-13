// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
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
  {
    // Una feature solo puede depender de core y shared, nunca de otra feature.
    files: ['src/app/features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@features/*'], message: 'Una feature no puede importar de otra feature.' },
            {
              group: ['../../*'],
              message: 'Los imports relativos no pueden salir de la feature; usa @core o @shared.',
            },
          ],
        },
      ],
    },
  },
  {
    // Archivos en la raíz de una feature (p. ej. rutas): un solo ../ ya sale de la feature.
    files: ['src/app/features/*/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@features/*'], message: 'Una feature no puede importar de otra feature.' },
            {
              group: ['../*'],
              message: 'Los imports relativos no pueden salir de la feature; usa @core o @shared.',
            },
          ],
        },
      ],
    },
  },
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
