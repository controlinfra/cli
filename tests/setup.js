/**
 * Jest test setup for Controlinfra CLI
 * Configures the CLI to use stage server for E2E tests
 */

const Conf = require('conf');

// Stage server configuration
const STAGE_API_URL = process.env.CONTROLINFRA_API_URL || 'https://api-market-stage.controlinfra.com';
const TEST_TOKEN = process.env.CONTROLINFRA_TEST_TOKEN;

// Check for required env vars in E2E tests
beforeAll(() => {
  if (process.env.npm_lifecycle_event === 'test:e2e' ||
      process.argv.some(arg => arg.includes('e2e'))) {
    if (!TEST_TOKEN) {
      console.warn('\n⚠️  CONTROLINFRA_TEST_TOKEN not set. E2E tests may fail.\n');
    }
  }
});

// Configure the CLI config store for tests
const setupTestConfig = () => {
  const config = new Conf({ projectName: 'controlinfra-test' });

  // Set test configuration
  config.set('apiUrl', STAGE_API_URL);
  if (TEST_TOKEN) {
    config.set('token', TEST_TOKEN);
  }

  return config;
};

// Clean up test config after all tests
afterAll(() => {
  try {
    const config = new Conf({ projectName: 'controlinfra-test' });
    config.clear();
  } catch (e) {
    // Ignore cleanup errors
  }
});

// Export helpers for tests
global.testConfig = {
  apiUrl: STAGE_API_URL,
  token: TEST_TOKEN,
  setupTestConfig,
};
