'use strict';

/**
 * The CLI identifies itself on every request so a CLI session is
 * recognisable in Settings → Active sessions. Before this, the CLI sent
 * axios's default and the session showed up as an unidentifiable HTTP
 * client — the one row a user reviewing their sessions cannot place.
 *
 * The dashboard parses this exact shape, so the format is a contract, not a
 * cosmetic string.
 */

import { getVersion, getUserAgent } from '../../src/version.js';

const VERSION = getVersion();
const USER_AGENT = getUserAgent();

describe('CLI User-Agent', () => {
  it('reports the real package version, not a hardcoded one', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const pkg = JSON.parse(readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
      'utf8',
    ));
    expect(VERSION).toBe(pkg.version);
  });

  it('matches the shape the dashboard parses', () => {
    // Dashboard: /controlinfra-cli\/(\d+\.\d+\.\d+[\w.-]*)/ plus a platform
    // in parentheses. Changing this format silently downgrades every CLI row
    // in Active sessions to an unrecognised agent.
    expect(USER_AGENT).toMatch(/^controlinfra-cli\/\d+\.\d+\.\d+[\w.-]*\s\([a-z0-9]+;\snode\s\d+\.\d+\.\d+\)$/);
  });

  it('carries the running platform and node version', () => {
    expect(USER_AGENT).toContain(process.platform);
    expect(USER_AGENT).toContain(process.versions.node);
  });

  it('leaks nothing beyond what the server already sees', () => {
    // No hostname, username, cwd or path — the header travels with every
    // request and must not become an exfiltration channel.
    expect(USER_AGENT).not.toMatch(/[/\\](home|Users)[/\\]/);
    expect(USER_AGENT.split(/\s+/).length).toBeLessThanOrEqual(5);
  });
});
