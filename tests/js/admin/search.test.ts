import { buildIndex, createSearch, matchEntries, normalize, statusText } from '../../../src/ts/admin/search';
import { renderForm } from '../../../src/ts/admin/form-renderer';
import { sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const mount = () => {
  const form = renderForm(sampleContext());
  document.body.replaceChildren(form.element);
  return form;
};

const type = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('settings search', () => {
  it('indexes every control that carries a path', () => {
    const form = mount();
    const entries = buildIndex(form.element);
    const paths = entries.map((entry) => entry.path);
    expect(paths).toContain('tokens.zIndex');
    expect(paths).toContain('maintenance.keepDataOnUninstall');
    expect(new Set(paths).size).toBe(paths.length);
    expect(entries.find((entry) => entry.path === 'tokens.zIndex')).toMatchObject({ tabId: 'appearance', tabLabel: 'Appearance' });
  });

  it('matches without accents or case and across hyphens', () => {
    const form = mount();
    const entries = buildIndex(form.element);
    expect(normalize('Zażółć')).toBe('zazołc');
    expect(matchEntries(entries, 'Z-INDEX').map((entry) => entry.path)).toContain('tokens.zIndex');
    expect(matchEntries(entries, 'stacking order').map((entry) => entry.path)).toEqual(['tokens.zIndex']);
    expect(matchEntries(entries, '   ')).toEqual([]);
    expect(matchEntries(entries, 'no such setting anywhere')).toEqual([]);
  });

  it('announces the result count', () => {
    expect(statusText('', 0)).toBe('');
    expect(statusText('x', 0)).toBe('No settings found.');
    expect(statusText('x', 1)).toBe('1 setting found.');
    expect(statusText('x', 4)).toBe('4 settings found.');
  });

  it('activating a result selects the tab, focuses the control and marks it', () => {
    const form = mount();
    const search = createSearch(() => form);
    document.body.prepend(search.element);
    type(search.input, 'z-index');
    const status = search.element.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toBe('1 setting found.');
    const result = search.element.querySelector('.ka11y-search__result') as HTMLButtonElement;
    result.click();
    expect(form.activeId()).toBe('appearance');
    const field = document.querySelector('[data-ka11y-path="tokens.zIndex"]') as HTMLElement;
    expect(field.classList.contains('is-found')).toBe(true);
    expect(document.activeElement).toBe(field.querySelector('input'));
    (document.activeElement as HTMLElement).blur();
    expect(field.classList.contains('is-found')).toBe(false);
  });

  it('escape clears the query and the results', () => {
    const form = mount();
    const search = createSearch(() => form);
    document.body.prepend(search.element);
    type(search.input, 'size');
    expect(search.element.querySelectorAll('.ka11y-search__result').length).toBeGreaterThan(0);
    search.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(search.input.value).toBe('');
    expect(search.element.querySelectorAll('.ka11y-search__result')).toHaveLength(0);
  });

  it('labels the search landmark and input', () => {
    const search = createSearch(() => undefined);
    document.body.replaceChildren(search.element);
    expect(search.element.getAttribute('role')).toBe('search');
    const label = search.element.querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe(search.input.id);
    type(search.input, 'x');
    expect(search.element.querySelector('[role="status"]')?.textContent).toBe('No settings found.');
  });
});
