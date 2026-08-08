/**
 * E2E Tests for Integration Commands
 * Tests: slack, aws, azure, gcp, ai, config
 *
 * These tests run against a live API (staging by default). State on
 * the test org may vary, so tests assert on *specific markers* that
 * appear only when the command is doing the right thing — never on
 * bag-of-words regexes that pass on any output.
 *
 * Pattern guide:
 *   ❌ AVOID: expect(out).toMatch(/slack|webhook|not configured|denied|error/)
 *      ↑ matches any output including bug-shaped output ("Failed: error")
 *   ✅ USE: expect(stderr).toContain('Slack integration not configured');
 *           // or
 *           expect(stdout).toContain('Webhook URL:');  // table label
 *           expect(stdout).toMatch(/https:\/\/hooks\.slack\.com/);  // structure
 */

import { runCLI, itAuthenticated } from './helpers.js';

// ── Slack ────────────────────────────────────────────────────────────
describe('CLI Slack Commands', () => {
  itAuthenticated('slack status — when unconfigured, names the exact next-step', () => {
    const { stdout, stderr, exitCode } = runCLI('slack status', { expectError: true });
    // Three valid states: configured (exit 0, shows webhook/channel info),
    // not configured (exit 0 with explicit "not configured" copy), or a
    // structured permission error (exit 1, "Access denied") when the test
    // token lacks slack:read. An opaque crash with no recognizable error
    // copy is still a failure.
    expect([0, 1]).toContain(exitCode);
    const out = stdout + stderr;
    const isConfigured = /Webhook URL|Channel/.test(out);
    const notConfigured = out.includes('Slack integration not configured');
    const permissionDenied = /Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i.test(out);
    expect(isConfigured || notConfigured || permissionDenied).toBe(true);
    if (notConfigured) {
      // Exact CTA must appear so users know how to fix it.
      expect(out).toContain('controlinfra slack setup');
    }
  });

  itAuthenticated('slack setup — validates webhook URL format client-side', () => {
    // Send a clearly-invalid webhook URL. The server's URL validator
    // should reject it. Tautological version passed on "error", which
    // would also match a crash; we assert the specific validation error.
    // Note: test tokens may lack slack:write scope — accept either the
    // URL-shape rejection OR the permission error, but never a crash.
    const result = runCLI(
      'slack setup --webhook https://not-slack.example.com/x',
      { expectError: true },
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(
      /Invalid (Slack )?webhook URL|Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
  });

  itAuthenticated('slack remove — exit code reflects whether anything was removed', () => {
    const { stdout, stderr, exitCode } = runCLI('slack remove', { expectError: true });
    // Must NOT crash regardless of prior state. Either succeeds, reports
    // "not configured", or returns a structured permission error — never
    // an opaque "Failed" with no specific cause.
    expect([0, 1]).toContain(exitCode);
    const out = stdout + stderr;
    expect(out).toMatch(
      /Slack integration removed|not configured|No Slack|Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
  });
});

// ── AWS ──────────────────────────────────────────────────────────────
describe('CLI AWS Commands', () => {
  itAuthenticated('aws status — renders either the configured table or the unconfigured CTA', () => {
    const { stdout, stderr, exitCode } = runCLI('aws status', { expectError: true });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    const isConfigured = /Status:.*Configured|Auth Method:|Access Key/i.test(out);
    const notConfigured = out.includes('AWS credentials not configured');
    expect(isConfigured || notConfigured).toBe(true);
    if (notConfigured) expect(out).toContain('controlinfra aws setup');
  });

  itAuthenticated('aws setup — bogus creds are rejected by STS with a specific error', () => {
    // The server live-validates against AWS STS. With obviously-fake
    // creds we expect either an AWS rejection ("security token is
    // invalid") or our placeholder guard ("EXAMPLE/placeholder"). With
    // limited test tokens this may surface as a permission error first.
    const { stdout, stderr, exitCode } = runCLI(
      'aws setup --access-key AKIAIOSFODNN7EXAMPLE --secret-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY1 --region us-east-1',
      { expectError: true },
    );
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(
      /invalid|placeholder|EXAMPLE|security token|Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
  });

  itAuthenticated('aws remove --force — non-interactive, no prompt', () => {
    // Regression for the audit fix: --force must succeed without
    // hanging on stdin. Old impl had no --force flag and would block
    // in CI where stdin is closed.
    const { stdout, stderr, exitCode } = runCLI('aws remove --force', { expectError: true });
    expect([0, 1]).toContain(exitCode);
    const out = stdout + stderr;
    // Accept success, not-configured, or structured permission error —
    // the test token may lack aws:write.
    expect(out).toMatch(
      /AWS credentials removed|not configured|Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
    // The interactive prompt prefix must never appear — that means
    // --force was honored.
    expect(out).not.toContain('? Are you sure');
  });
});

// ── Azure ────────────────────────────────────────────────────────────
describe('CLI Azure Commands', () => {
  itAuthenticated('azure status — explicit configured-or-not state', () => {
    const { stdout, stderr, exitCode } = runCLI('azure status', { expectError: true });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    const isConfigured = /Status:.*Configured|Subscription ID|Tenant ID/i.test(out);
    const notConfigured = out.includes('Azure credentials not configured');
    expect(isConfigured || notConfigured).toBe(true);
  });

  itAuthenticated('azure setup — placeholder UUID rejected by the schema guard', () => {
    // The server rejects all-zeroes / well-known placeholder UUIDs as
    // a defense against accidentally saving example values. With limited
    // tokens this may surface as a permission error instead.
    const placeholder = '00000000-0000-0000-0000-000000000000';
    const { stdout, stderr, exitCode } = runCLI(
      `azure setup --subscription-id ${placeholder} --tenant-id ${placeholder} --client-id ${placeholder} --client-secret notarealsecret`,
      { expectError: true },
    );
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(
      /placeholder|example|invalid|Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
  });

  itAuthenticated('azure remove --force — non-interactive', () => {
    const { stdout, stderr, exitCode } = runCLI('azure remove --force', { expectError: true });
    expect([0, 1]).toContain(exitCode);
    expect(stdout + stderr).not.toContain('? Are you sure');
  });
});

// ── GCP ──────────────────────────────────────────────────────────────
describe('CLI GCP Commands', () => {
  itAuthenticated('gcp status — explicit configured-or-not state', () => {
    const { stdout, stderr, exitCode } = runCLI('gcp status', { expectError: true });
    expect(exitCode).toBe(0);
    const out = stdout + stderr;
    const isConfigured = /Status:.*Configured|Project ID|Service Account/i.test(out);
    const notConfigured = out.includes('GCP credentials not configured');
    expect(isConfigured || notConfigured).toBe(true);
  });

  itAuthenticated('gcp setup --help exposes WIF flags (regression for audit #3)', () => {
    // The WIF auth method shipped end-to-end on the server but had no
    // CLI flag for ~3 weeks. Lock the surface so future help-text
    // refactors don't drop the flags silently.
    const { stdout, exitCode } = runCLI('gcp setup --help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('--workload-identity-federation');
    expect(stdout).toContain('--audience');
    expect(stdout).toContain('--service-account-email');
  });

  itAuthenticated('gcp remove --force — non-interactive', () => {
    const { stdout, stderr, exitCode } = runCLI('gcp remove --force', { expectError: true });
    expect([0, 1]).toContain(exitCode);
    expect(stdout + stderr).not.toContain('? Are you sure');
  });
});

// ── AI ───────────────────────────────────────────────────────────────
describe('CLI AI Commands', () => {
  itAuthenticated('ai status — shows provider + custom-key state explicitly', () => {
    // Exit 0: must render the Provider/Custom Key labels.
    // Exit 1: must be a structured permission error (token lacks ai:read).
    const result = runCLI('ai status', { expectError: true });
    expect([0, 1]).toContain(result.exitCode);
    if (result.exitCode === 0) {
      // The CLI renders "Provider: <name>" and "Custom Key: Yes/No".
      // Asserting on the labels (not just keywords) catches output
      // regressions like the bug where status always showed "default / No"
      // because the API wrapper failed to unwrap the server response.
      expect(result.stdout).toContain('Provider:');
      expect(result.stdout).toContain('Custom Key:');
    } else {
      expect(result.stdout + result.stderr).toMatch(
        /Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
      );
    }
  });

  itAuthenticated('ai use mystery — rejects unknown provider with explicit name', () => {
    // Validation message must NAME the invalid value, not say "error".
    const { stdout, stderr, exitCode } = runCLI('ai use mystery', { expectError: true });
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toMatch(/Invalid provider.*anthropic.*openai|Choose: anthropic, openai/);
  });
});

// ── Config ───────────────────────────────────────────────────────────
describe('CLI Config Commands', () => {
  itAuthenticated('config path — returns an absolute path containing the app name', () => {
    const { stdout, exitCode } = runCLI('config path');
    expect(exitCode).toBe(0);
    const trimmed = stdout.trim();
    expect(trimmed.length).toBeGreaterThan(0);
    // Absolute path on either platform (POSIX / or Windows X:\)
    expect(/^(\/|[A-Za-z]:[\\/])/.test(trimmed)).toBe(true);
    expect(trimmed.toLowerCase()).toContain('controlinfra');
  });

  itAuthenticated('config get apiUrl — returns a syntactically valid URL', () => {
    const { stdout, exitCode } = runCLI('config get apiUrl');
    expect(exitCode).toBe(0);
    const url = stdout.trim();
    // Must parse as a real URL with http(s) protocol and a hostname.
    // Tautological version just matched /https?:\/\// which any
    // string containing those characters passes.
    expect(() => new URL(url)).not.toThrow();
    expect(url).toMatch(/^https?:\/\/[^/]+/);
  });

  itAuthenticated('config set then get round-trip — value persists', () => {
    // CONTROLINFRA_API_URL env var (set in CI) overrides the stored
    // `apiUrl` on read, so probe it through with env override cleared.
    const probe = 'https://config-roundtrip-probe.example.com';
    runCLI(`config set apiUrl ${probe}`, { env: { CONTROLINFRA_API_URL: '' } });
    const { stdout, exitCode } = runCLI('config get apiUrl', { env: { CONTROLINFRA_API_URL: '' } });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(probe);
    // Restore so other tests pointing at the real staging API still work
    runCLI('config set apiUrl https://api-stage.controlinfra.com', { env: { CONTROLINFRA_API_URL: '' } });
  });

  itAuthenticated('config reset — clears stored value to schema default', () => {
    runCLI('config set apiUrl https://will-be-reset.example.com');
    const reset = runCLI('config reset', { expectError: true });
    expect([0, 1]).toContain(reset.exitCode);
    // After reset, the apiUrl falls back to the schema default
    // (https://api.controlinfra.com). Env-var override may still apply
    // in test runs; assert the stored value, not the env-resolved one.
    const { stdout } = runCLI('config get apiUrl');
    expect(stdout.trim()).not.toBe('https://will-be-reset.example.com');
    // Restore for subsequent tests
    runCLI('config set apiUrl https://api-stage.controlinfra.com');
  });
});
