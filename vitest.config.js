import { defineConfig } from 'vitest/config';

// The CLI moved to ESM (see issue #285). Vitest rather than Jest because its
// module mocking works natively with ESM: `vi.mock` is hoisted the same way
// `jest.mock` was, whereas Jest's ESM path needs `unstable_mockModule` plus a
// dynamic import in every mocked test — a restructure of all 42 mock sites
// rather than a rename.
//
// globals: true keeps describe/it/expect/vi ambient, so the 25 test files did
// not each need a new import line on top of everything else changing.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    // Relative to --dir when given (npm test scopes to tests/unit), so keep
    // this pattern anchor-free.
    include: ['**/*.test.js'],
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/index.js'],
      reportsDirectory: 'coverage',
    },
  },
});
