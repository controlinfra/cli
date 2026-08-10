import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Single source for the CLI version, used by `--version` and by the
// User-Agent every API request carries.
//
// Read from package.json rather than imported: JSON import assertions are
// still behind a flag on the runtimes the binaries target. This also resolves
// inside the pkg snapshot — package.json is declared in pkg.assets so it is
// bundled rather than relying on pkg's static analysis noticing this read.
//
// Resolved LAZILY and cached, not at module load. Reading a file while the
// module graph is still evaluating means any failure — a stripped snapshot, a
// permission error, a test that stubs node:fs — throws before commander is
// initialised and takes down every command, including ones that never needed
// the version. Deferring it keeps a bad read to a degraded string.
let cached;

export function getVersion() {
  if (cached !== undefined) return cached;
  try {
    const raw = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
      'utf8',
    );
    cached = JSON.parse(raw).version || 'unknown';
  } catch {
    // Honest placeholder. Inventing a plausible version number here would put
    // a wrong value on `--version` and in the session list.
    cached = 'unknown';
  }
  return cached;
}

/**
 * Sent on every request so a CLI session is identifiable in Settings →
 * Active sessions. Without it the CLI sends whatever axios defaults to, and
 * the session shows up as a bare HTTP client with no version — exactly the
 * row a user cannot recognise when reviewing their own sessions.
 *
 * Platform and Node version are included because "which machine is this?" is
 * the question that screen exists to answer, and they narrow it without
 * revealing anything the server does not already see. Nothing host-specific
 * (hostname, user, paths) belongs here — this header travels on every request.
 */
export function getUserAgent() {
  return `controlinfra-cli/${getVersion()} (${process.platform}; node ${process.versions.node})`;
}
