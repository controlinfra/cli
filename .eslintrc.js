module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Allow console for CLI apps
    'no-console': 'off',
    // Consistent quotes
    quotes: ['error', 'single', { avoidEscape: true }],
    // Trailing commas
    'comma-dangle': ['error', 'always-multiline'],
    // Allow unused vars with underscore prefix
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Semicolons
    semi: ['error', 'always'],
  },
};
