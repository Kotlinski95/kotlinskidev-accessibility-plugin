import { bindShortcut, matchesCombo, parseCombo } from '../../src/ts/frontend/shortcut';

const event = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

describe('shortcut', () => {
  it('parses a combo', () => {
    expect(parseCombo('Alt+Shift+A')).toEqual({ alt: true, shift: true, ctrl: false, meta: false, key: 'a', code: 'KeyA' });
  });

  it('parses aliases and digits', () => {
    expect(parseCombo('Ctrl+Option+1')).toMatchObject({ ctrl: true, alt: true, key: '1', code: 'Digit1' });
    expect(parseCombo('cmd+k')).toMatchObject({ meta: true, key: 'k' });
  });

  it('rejects invalid combos', () => {
    expect(parseCombo('')).toBeNull();
    expect(parseCombo('Alt+Shift')).toBeNull();
    expect(parseCombo('Alt+A+B')).toBeNull();
    expect(parseCombo('Alt++A')).toBeNull();
  });

  it('matches by code or key with exact modifiers', () => {
    const combo = parseCombo('Alt+Shift+A');
    if (!combo) throw new Error('combo');
    expect(matchesCombo(combo, event({ altKey: true, shiftKey: true, code: 'KeyA', key: 'a' }))).toBe(true);
    expect(matchesCombo(combo, event({ altKey: true, shiftKey: true, code: 'KeyA', key: 'å' }))).toBe(true);
    expect(matchesCombo(combo, event({ altKey: true, shiftKey: true, code: 'KeyB', key: 'A' }))).toBe(true);
    expect(matchesCombo(combo, event({ altKey: true, code: 'KeyA', key: 'a' }))).toBe(false);
    expect(matchesCombo(combo, event({ altKey: true, shiftKey: true, ctrlKey: true, code: 'KeyA', key: 'a' }))).toBe(false);
    expect(matchesCombo(combo, event({ altKey: true, shiftKey: true, code: 'KeyB', key: 'b' }))).toBe(false);
  });

  it('toggles on keydown and unbinds', () => {
    const onToggle = jest.fn();
    const unbind = bindShortcut({ config: { enabled: true, combo: 'Alt+Shift+A' }, onToggle });
    document.dispatchEvent(event({ altKey: true, shiftKey: true, code: 'KeyA', key: 'a' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    unbind();
    document.dispatchEvent(event({ altKey: true, shiftKey: true, code: 'KeyA', key: 'a' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const onToggle = jest.fn();
    bindShortcut({ config: { enabled: false, combo: 'Alt+Shift+A' }, onToggle });
    document.dispatchEvent(event({ altKey: true, shiftKey: true, code: 'KeyA', key: 'a' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
