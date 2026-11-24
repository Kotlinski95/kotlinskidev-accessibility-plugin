import { isChunkRecord, RUNTIME_ABI } from '../../src/ts/shared/runtime';

describe('runtime handoff', () => {
  it('uses ABI 1', () => {
    expect(RUNTIME_ABI).toBe(1);
  });

  it('accepts a well formed chunk record', () => {
    expect(isChunkRecord(['panel', 1, () => ({})])).toBe(true);
  });

  it('rejects malformed records', () => {
    expect(isChunkRecord(['nope', 1, () => ({})])).toBe(false);
    expect(isChunkRecord(['panel', '1', () => ({})])).toBe(false);
    expect(isChunkRecord(['panel', 1])).toBe(false);
    expect(isChunkRecord(['panel', 1, 'x'])).toBe(false);
    expect(isChunkRecord(null)).toBe(false);
  });
});
