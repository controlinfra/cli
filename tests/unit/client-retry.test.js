'use strict';

/**
 * Unit tests for the API client's transient-retry policy. The actual axios
 * wiring is integration-tested by the E2E suite; here we lock the pure
 * predicate that decides what is safe to replay.
 */

import { isRetryable, retryDelayMs } from '../../src/api/client.js';

const err = (over = {}) => ({ config: { method: 'get' }, ...over });

describe('isRetryable', () => {
  it('retries idempotent GET on a connection reset', () => {
    expect(isRetryable(err({ code: 'ECONNRESET' }))).toBe(true);
  });

  it('retries idempotent DELETE on a timeout', () => {
    expect(isRetryable(err({ config: { method: 'delete' }, code: 'ETIMEDOUT' }))).toBe(true);
  });

  it('retries GET on a 503/502/504', () => {
    expect(isRetryable(err({ response: { status: 503 } }))).toBe(true);
    expect(isRetryable(err({ response: { status: 502 } }))).toBe(true);
    expect(isRetryable(err({ response: { status: 504 } }))).toBe(true);
  });

  it('does NOT retry POST even on a connection reset (avoid double-create)', () => {
    expect(isRetryable(err({ config: { method: 'post' }, code: 'ECONNRESET' }))).toBe(false);
  });

  it('does NOT retry a 4xx or 500', () => {
    expect(isRetryable(err({ response: { status: 404 } }))).toBe(false);
    expect(isRetryable(err({ response: { status: 429 } }))).toBe(false);
    expect(isRetryable(err({ response: { status: 500 } }))).toBe(false);
  });

  it('does NOT retry a non-transient network code', () => {
    expect(isRetryable(err({ code: 'ECONNREFUSED' }))).toBe(false);
  });

  it('defaults missing method to GET (retryable)', () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });
});

describe('retryDelayMs', () => {
  it('backs off linearly per attempt', () => {
    expect(retryDelayMs(1)).toBe(300);
    expect(retryDelayMs(2)).toBe(600);
  });
});
