import { MAX_PREVIEW_ROWS, buildChangeTable, formatValue, previewChanges } from '../../../src/ts/admin/change-preview';
import type { SettingChange } from '../../../src/ts/admin/types';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const change = (path: string, from: unknown, to: unknown): SettingChange => ({ path, from, to, source: 'site' });

const options = (changes: SettingChange[]) => ({ title: 'Save?', message: 'Sure?', confirmLabel: 'Save', changes });

describe('change preview', () => {
  it('formats each value type', () => {
    expect(formatValue(true)).toBe('On');
    expect(formatValue(false)).toBe('Off');
    expect(formatValue('')).toBe('(empty)');
    expect(formatValue(null)).toBe('(empty)');
    expect(formatValue(12)).toBe('12');
    expect(formatValue('abc')).toBe('abc');
    expect(formatValue([])).toBe('(none)');
    expect(formatValue(['a', 2])).toBe('a, 2');
    expect(formatValue({})).toBe('(none)');
    expect(formatValue({ pl_PL: 'x' })).toBe('{"pl_PL":"x"}');
    expect(formatValue('x'.repeat(200))).toHaveLength(121);
  });

  it('caps the table at 50 rows and says how many are hidden', () => {
    const many = Array.from({ length: 53 }, (_, index) => change(`a.b${index}`, 1, 2));
    const table = buildChangeTable(many);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(MAX_PREVIEW_ROWS);
    expect(table.querySelector('.ka11y-changes__more')?.textContent).toBe('3 more changes are not shown.');
    expect(table.querySelector('caption')?.textContent).toBe('53 changes');
    expect(buildChangeTable([change('a.b', 1, 2), change('a.c', 1, 2)], {}).querySelector('.ka11y-changes__more')).toBeNull();
  });

  it('lists warnings for adjusted, locked and dropped settings', () => {
    const table = buildChangeTable([change('a.b', 1, 2)], { adjusted: ['a.b'], locked: ['x.y'], dropped: ['old.key'] });
    const notes = [...table.querySelectorAll('.ka11y-changes__notes li')].map((item) => item.textContent);
    expect(notes).toEqual([
      'Adjusted to a valid value: a.b.',
      'Locked by site configuration and left unchanged: x.y.',
      'Ignored unknown settings: old.key.',
    ]);
    expect(buildChangeTable([change('a.b', 1, 2)]).querySelector('.ka11y-changes__notes')).toBeNull();
  });

  it('opens no dialog without changes', async () => {
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    await expect(previewChanges(host, options([]))).resolves.toBe(true);
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('confirms, cancels and returns focus to the trigger', async () => {
    const host = document.createElement('div');
    const trigger = document.createElement('button');
    host.append(trigger);
    document.body.replaceChildren(host);
    trigger.focus();
    const answer = previewChanges(host, options([change('a.b', 1, 2)]));
    const dialog = host.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.querySelector('.ka11y-changes')?.getAttribute('tabindex')).toBe('0');
    expect(dialog.querySelector('.ka11y-changes')?.getAttribute('aria-label')).toBe('Changes');
    const buttons = dialog.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(false);
    expect(document.activeElement).toBe(trigger);
    const second = previewChanges(host, options([change('a.b', 1, 2)]));
    const confirm = host.querySelectorAll('[role="alertdialog"] button')[1] as HTMLButtonElement;
    confirm.click();
    await expect(second).resolves.toBe(true);
    await flush();
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
