import { describe, expect, it } from 'vitest';
import {
  PREFILL_LOG_EVENT,
  prefillLogPalette,
  readPrefillLogEvent,
} from './command-log-model';

describe('prefill log event contract', () => {
  it('round-trips a query through the factory and the reader', () => {
    const target = new EventTarget();
    let received: string | null | undefined;
    target.addEventListener(PREFILL_LOG_EVENT, (event) => {
      received = readPrefillLogEvent(event);
    });
    prefillLogPalette('  2 cups rice  ', target);
    expect(received).toBe('2 cups rice');
  });

  // The log sheet used to dispatch the draft as a bare string while the
  // palette read `detail.query`, so "Meal → Find this food" never opened it.
  // The reader refuses that shape instead of guessing, which is what makes the
  // shared factory the only working path.
  it('returns null for the bare-string payload the old shell sent', () => {
    const event = new CustomEvent(PREFILL_LOG_EVENT, { detail: '2 cups rice' });
    expect(readPrefillLogEvent(event)).toBeNull();
  });

  it('returns null for an empty or missing query', () => {
    expect(readPrefillLogEvent(new CustomEvent(PREFILL_LOG_EVENT, { detail: { query: '   ' } }))).toBeNull();
    expect(readPrefillLogEvent(new CustomEvent(PREFILL_LOG_EVENT, { detail: {} }))).toBeNull();
    expect(readPrefillLogEvent(new CustomEvent(PREFILL_LOG_EVENT))).toBeNull();
    expect(readPrefillLogEvent(new Event(PREFILL_LOG_EVENT))).toBeNull();
  });
});
