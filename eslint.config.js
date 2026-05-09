'use strict';

// Flat config for the CLI (`eslint src`). Replaces legacy
// `cli/.eslintrc.js`. CLI runs as a Node script so we allow
// `console` output and use the lighter rule set the legacy config
// already had — no need to enforce strict mode globally because
// many files use modern import/export-style syntax (sourceType:
// 'module' in legacy config).

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // CLI explicitly prints to console — that's its job.
      'no-console': 'off',

      // ESLint v9 changed `caughtErrors` default from `'none'` to
      // `'all'`; underscore-prefix marks "declared but unused".
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Style consistency (deprecated in eslint 9, removed in 10 —
      // see comment in the root config for the @stylistic plan).
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
      semi: ['error', 'always'],
    },
  },
];
