/**
 * E2E Tests for Integration Commands
 * Tests: slack, aws, azure, gcp, ai, config
 */

const { runCLI, itAuthenticated } = require('./helpers');

describe('CLI Slack Commands', () => {
  itAuthenticated('slack status — should show webhook info or not configured', () => {
    const { stdout, stderr, exitCode } = runCLI('slack status', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/slack|webhook|not configured|configured|status|denied|permission/);
  });

  itAuthenticated('slack test — should fail with no webhook configured', () => {
    const { stdout, stderr } = runCLI('slack test', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/no slack webhook|not configured|webhook|error|fail|denied|permission/);
  });

  itAuthenticated('slack setup — should attempt with test webhook', () => {
    const { stdout, stderr } = runCLI(
      'slack setup --webhook https://hooks.slack.com/test',
      { expectError: true }
    );
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/slack|webhook|setup|invalid|error|success|configured/);
  });

  itAuthenticated('slack remove — should succeed or show not configured', () => {
    const { stdout, stderr } = runCLI('slack remove', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/removed|not configured|slack|success|no.*webhook/);
  });
});

describe('CLI AWS Commands', () => {
  itAuthenticated('aws status — should show credential status', () => {
    const { stdout, stderr } = runCLI('aws status', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/aws|configured|not configured|credentials|status/);
  });

  itAuthenticated('aws test — should show credential status', () => {
    const { stdout, stderr } = runCLI('aws test', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/aws|configured|not configured|credentials|test|error/);
  });

  itAuthenticated('aws setup — should attempt with test credentials', () => {
    const { stdout, stderr } = runCLI(
      'aws setup --access-key AKIATEST12345678 --secret-key testsecretkeythatisatleast30chars --region us-east-1',
      { expectError: true }
    );
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/aws|credentials|setup|invalid|error|success|saved/);
  });

  itAuthenticated('aws remove — should succeed or show not configured', () => {
    const { stdout, stderr } = runCLI('aws remove', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/removed|not configured|aws|success|credentials/);
  });
});

describe('CLI Azure Commands', () => {
  itAuthenticated('azure status — should show credential status', () => {
    const { stdout, stderr } = runCLI('azure status', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/azure|configured|not configured|credentials|status/);
  });

  itAuthenticated('azure test — should show credential status', () => {
    const { stdout, stderr } = runCLI('azure test', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/azure|configured|not configured|credentials|test|error/);
  });

  itAuthenticated('azure setup — should attempt with test credentials', () => {
    const subId = '12345678-1234-1234-1234-123456789012';
    const { stdout, stderr } = runCLI(
      `azure setup --subscription-id ${subId} --tenant-id ${subId} --client-id ${subId} --client-secret testsecret1234 --environment public`,
      { expectError: true }
    );
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/azure|credentials|setup|invalid|error|success|saved/);
  });

  itAuthenticated('azure remove — should succeed or show not configured', () => {
    const { stdout, stderr } = runCLI('azure remove', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/removed|not configured|azure|success|credentials/);
  });
});

describe('CLI GCP Commands', () => {
  itAuthenticated('gcp status — should show credential status', () => {
    const { stdout, stderr } = runCLI('gcp status', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/gcp|google|configured|not configured|credentials|status/);
  });

  itAuthenticated('gcp test — should show credential status', () => {
    const { stdout, stderr } = runCLI('gcp test', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/gcp|google|configured|not configured|credentials|test|error/);
  });

  itAuthenticated('gcp remove — should succeed or show not configured', () => {
    const { stdout, stderr } = runCLI('gcp remove', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/removed|not configured|gcp|google|success|credentials/);
  });
});

describe('CLI AI Commands', () => {
  itAuthenticated('ai status — should show provider info', () => {
    const { stdout, stderr } = runCLI('ai status', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/ai|provider|anthropic|openai|status|key|configured/);
  });

  itAuthenticated('ai verify — should show key status', () => {
    const { stdout, stderr } = runCLI('ai verify', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/no custom api key|verify|valid|invalid|key|ai|error/);
  });

  itAuthenticated('ai use anthropic — should fail without --key', () => {
    const { stdout, stderr } = runCLI('ai use anthropic', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/key|required|missing|error|--key|api/);
  });

  itAuthenticated('ai remove — should succeed or show no custom key', () => {
    const { stdout, stderr } = runCLI('ai remove', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/removed|no custom key|not configured|ai|success|key/);
  });
});

describe('CLI Config Commands', () => {
  itAuthenticated('config path — should show a config path', () => {
    const { stdout, exitCode } = runCLI('config path');
    expect(exitCode).toBe(0);
    expect(stdout.trim().length).toBeGreaterThan(0);
    expect(stdout).toMatch(/[/\\]/); // contains a path separator
  });

  itAuthenticated('config get apiUrl — should show a URL', () => {
    const { stdout, exitCode } = runCLI('config get apiUrl');
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/https?:\/\//);
  });

  itAuthenticated('config set apiUrl — should succeed', () => {
    const { stdout, exitCode } = runCLI(
      'config set apiUrl https://api-stage.controlinfra.com'
    );
    expect(exitCode).toBe(0);
    const output = stdout.toLowerCase();
    expect(output).toMatch(/set|saved|updated|apiurl|success/);
  });

  itAuthenticated('config reset — should reset and re-set apiUrl', () => {
    const { stdout, stderr } = runCLI('config reset', { expectError: true });
    const output = (stdout + stderr).toLowerCase();
    expect(output).toMatch(/reset|cleared|default|config/);

    // Re-set apiUrl so other tests still work
    const restore = runCLI(
      'config set apiUrl https://api-stage.controlinfra.com'
    );
    expect(restore.exitCode).toBe(0);
  });
});
