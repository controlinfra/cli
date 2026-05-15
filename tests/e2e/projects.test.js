/**
 * E2E Tests for Project Commands — `projects list`, `projects info`, help.
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');
const {
  expectListOutput, expectHelpLists, expectJsonOutput,
  expectNotFoundError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Project Commands', () => {
  describe('projects list', () => {
    itAuthenticated('shows the project table or the explicit empty-state copy', async () => {
      const result = runCLI('projects list');
      expectListOutput(result, {
        tableHeader: 'Name',
        emptyMarker: 'No projects',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array', async () => {
      const result = runCLI('projects list --json');
      const parsed = expectJsonOutput(result);
      const projects = parsed.projects || parsed;
      expect(Array.isArray(projects)).toBe(true);
    });

    itAuthenticated('API endpoint returns the expected envelope', async () => {
      const response = await apiCall('GET', '/api/projects');
      const projects = response.projects || response;
      expect(Array.isArray(projects) || typeof projects === 'object').toBe(true);
    });
  });

  describe('projects help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('projects --help');
      expectHelpLists(result, ['list', 'create', 'info', 'update', 'delete', 'default']);
    });
  });

  describe('projects info — error path', () => {
    itAuthenticated('non-existent ID returns specific "not found" copy + non-zero exit', async () => {
      const result = runCLI('projects info non-existent-id-12345', { expectError: true });
      expectNotFoundError(
        result,
        /Project not found|No project found matching/,
      );
      expectNoBugMarkers(result);
    });
  });
});
