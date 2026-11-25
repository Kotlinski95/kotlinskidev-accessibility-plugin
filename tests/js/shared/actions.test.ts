import fixture from '../../fixtures/actions.json';
import { ACTION_PATTERN, isDialogAction, parseAction } from '../../../src/ts/shared/actions';
import type { ActionName } from '../../../src/ts/shared/actions';

describe('parseAction', () => {
  it.each(fixture.valid)('parses $action', ({ action, name, key, level }) => {
    expect(parseAction(action)).toEqual({ name, key, level });
  });

  it.each(fixture.invalid)('rejects %j', (action) => {
    expect(parseAction(action)).toBeNull();
  });

  it('keeps __proto__ as a plain string key', () => {
    const parsed = parseAction('feature:__proto__');
    expect(parsed?.key).toBe('__proto__');
    expect(Object.hasOwn({}, parsed?.key as string)).toBe(false);
  });
});

describe('ACTION_PATTERN', () => {
  it('matches the outer gate', () => {
    expect(ACTION_PATTERN.source).toBe('^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$');
  });

  it('accepts every valid fixture action', () => {
    fixture.valid.forEach(({ action }) => expect(ACTION_PATTERN.test(action)).toBe(true));
  });
});

describe('isDialogAction', () => {
  it.each(['open', 'close', 'toggle'] as ActionName[])('is true for %s', (name) => {
    expect(isDialogAction(name)).toBe(true);
  });

  it.each(['reset', 'feature', 'profile', 'statement', 'hide', 'show', 'trigger'] as ActionName[])(
    'is false for %s',
    (name) => {
      expect(isDialogAction(name)).toBe(false);
    },
  );
});
