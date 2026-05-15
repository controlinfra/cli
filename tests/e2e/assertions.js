/**
 * Focused assertion helpers for e2e tests.
 *
 * Replaces the tautological-regex pattern that let 14 audit bugs slip past:
 *   ❌ expect(out).toMatch(/word1|word2|word3|word4|word5/)
 *      ↑ passes on virtually any output, including bug-shaped output
 *
 * Use these helpers instead. They assert on the SPECIFIC markers a healthy
 * command emits, never on bag-of-words alternatives.
 *
 * Naming convention: each helper is `expectXxx` and throws (via jest's
 * `expect`) on the first failed assertion so the failure message points at
 * the line that's wrong.
 */

/**
 * A list command must EITHER render the table (with the given header label)
 * OR render the specific empty-state copy. Crashes / opaque errors fail.
 *
 *   expectListOutput(result, { tableHeader: 'Repository', emptyMarker: 'No repositories' });
 */
function expectListOutput(result, { tableHeader, emptyMarker }) {
  const { stdout, exitCode } = result;
  expect(exitCode).toBe(0);
  const out = stdout || '';
  // Either the column-header marker appears (table rendered) OR the
  // specific empty-state copy appears. Anything else means the CLI
  // crashed or rendered something we didn't expect.
  const hasTable = new RegExp(`(?:^| )${escape(tableHeader)}(?:[ \t]|$)`, 'm').test(out)
    || new RegExp(`(^| )${escape(tableHeader)}([\\s:]|$)`).test(out);
  const isEmpty = out.includes(emptyMarker);
  expect(hasTable || isEmpty).toBe(true);
}

/**
 * An info/detail command must show the expected field labels (e.g. "Name:",
 * "ID:"). Passing means the command actually rendered the detail box, not
 * just printed any output containing those words.
 *
 *   expectDetailOutput(result, ['Name:', 'Status:']);
 */
function expectDetailOutput(result, labels) {
  const { stdout, exitCode } = result;
  expect(exitCode).toBe(0);
  for (const label of labels) {
    expect(stdout).toContain(label);
  }
}

/**
 * A not-found error must match the specific "X not found" copy the controller
 * emits — not just any output containing the word "error".
 *
 *   expectNotFoundError(result, /Repository (configuration )?not found|No repository found/);
 */
function expectNotFoundError(result, pattern) {
  const { stdout, stderr, exitCode } = result;
  expect(exitCode).not.toBe(0);
  // Allow either stream because the CLI uses both
  expect((stdout || '') + (stderr || '')).toMatch(pattern);
}

/**
 * A help-text assertion must list ALL the subcommand names — surfaces
 * dropped subcommand registration regressions.
 *
 *   expectHelpLists(result, ['list', 'add', 'remove']);
 */
function expectHelpLists(result, subcommands) {
  const { stdout, exitCode } = result;
  expect(exitCode).toBe(0);
  for (const sub of subcommands) {
    expect(stdout).toContain(sub);
  }
}

/**
 * A flag must appear in the command's --help output. Catches regressions
 * where someone removes a flag from the registration but leaves the
 * command code in place.
 *
 *   expectHelpHasFlags(result, ['--workload-identity-federation', '--audience']);
 */
function expectHelpHasFlags(result, flags) {
  const { stdout, exitCode } = result;
  expect(exitCode).toBe(0);
  for (const flag of flags) {
    expect(stdout).toContain(flag);
  }
}

/**
 * A JSON-output command must produce parseable JSON (after stripping the
 * spinner text that ora may emit before the payload).
 *
 *   expectJsonOutput(result);  // returns parsed object
 */
function expectJsonOutput(result) {
  const { stdout, exitCode } = result;
  expect(exitCode).toBe(0);
  // Strip any non-JSON prefix (spinner text) — CLI commands often print
  // "- Fetching foo..." before the JSON payload.
  const jsonStart = stdout.search(/[[{]/);
  expect(jsonStart).toBeGreaterThanOrEqual(0);
  const raw = stdout.slice(jsonStart);
  let parsed;
  expect(() => { parsed = JSON.parse(raw); }).not.toThrow();
  return parsed;
}

/**
 * The output must NOT contain certain bug markers like the literal string
 * "[object Object]" (rendered when an object is template-literaled into a
 * string instead of accessing `.message`).
 *
 *   expectNoBugMarkers(result);
 */
function expectNoBugMarkers(result) {
  const out = (result.stdout || '') + (result.stderr || '');
  expect(out).not.toContain('[object Object]');
  expect(out).not.toContain('undefined undefined');
  expect(out).not.toContain('NaN');
}

/**
 * For commands gated by plan/role: result is either success or a structured
 * permission error — never an opaque crash.
 *
 *   expectSuccessOrPermissionError(result, () => {
 *     // assertions for the success path
 *     expect(result.stdout).toContain('Token created');
 *   });
 */
function expectSuccessOrPermissionError(result, onSuccess) {
  const { stdout, stderr, exitCode } = result;
  if (exitCode === 0) {
    onSuccess?.();
  } else {
    // Permission errors must use the specific HTTP 403 / "Access denied"
    // copy — not just any error word.
    expect((stdout || '') + (stderr || '')).toMatch(
      /Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i,
    );
  }
  expectNoBugMarkers(result);
}

function escape(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  expectListOutput,
  expectDetailOutput,
  expectNotFoundError,
  expectHelpLists,
  expectHelpHasFlags,
  expectJsonOutput,
  expectNoBugMarkers,
  expectSuccessOrPermissionError,
};
