module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000, // 30 seconds for E2E tests
  setupFilesAfterEnv: ['./tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
