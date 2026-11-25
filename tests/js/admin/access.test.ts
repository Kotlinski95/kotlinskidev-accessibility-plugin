import { isEditablePath, pruneToEditable } from '../../../src/ts/admin/access';
import { buildApp } from '../../../src/ts/admin/app';
import { renderForm } from '../../../src/ts/admin/form-renderer';
import { fakeApi, sampleConfig, sampleContext, sampleDefaults, sampleSchema } from './helpers';
import type { FormContext } from '../../../src/ts/admin/context';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, {
  virtual: true,
});
jest.mock('@wordpress/api-fetch', () => jest.requireActual('./wp-mocks').apiFetchMock, { virtual: true });

const EDITABLE = ['labels', 'statement', 'tokens', 'panel', 'theme.mode'];

const customerContext = (): FormContext => {
  const ctx = sampleContext();
  return {
    ...ctx,
    schema: { ...sampleSchema(), access: 'customer', editable: EDITABLE },
  };
};

const tabNames = (root: HTMLElement): string[] => {
  const tabs = root.matches('.ka11y-tabs') ? root : root.querySelector('.ka11y-tabs');
  return [...(tabs?.querySelectorAll(':scope > .ka11y-tabs__list > [role="tab"]') ?? [])].map((tab) => tab.textContent ?? '');
};

describe('customer mode', () => {
  it('matches editable prefixes exactly', () => {
    const schema = {
      ...sampleSchema(),
      access: 'customer' as const,
      editable: EDITABLE,
    };
    expect(isEditablePath(schema, 'tokens.primary')).toBe(true);
    expect(isEditablePath(schema, 'theme.mode')).toBe(true);
    expect(isEditablePath(schema, 'labels')).toBe(true);
    expect(isEditablePath(schema, 'theme.darkSelector')).toBe(false);
    expect(isEditablePath(schema, 'customCss')).toBe(false);
    expect(isEditablePath(schema, 'panelx')).toBe(false);
    expect(isEditablePath(schema, 'performance.strategy')).toBe(false);
  });

  it('treats full access as editable everywhere', () => {
    expect(isEditablePath(sampleSchema(), 'customCss')).toBe(true);
    expect(isEditablePath({ ...sampleSchema(), access: 'full', editable: null }, 'performance.strategy')).toBe(true);
  });

  it('renders only the Languages and Appearance tabs', () => {
    const form = renderForm(customerContext());
    expect(tabNames(form.element)).toEqual(['Appearance', 'Languages']);
    expect(form.element.querySelector('.ka11y-tab-reset')).toBeNull();
  });

  it('renders no field outside the editable paths', () => {
    const form = renderForm(customerContext());
    const paths = [...form.element.querySelectorAll('[data-ka11y-path]')].map((element) => element.getAttribute('data-ka11y-path') ?? '');
    expect(paths.length).toBeGreaterThan(10);
    for (const path of paths) expect(isEditablePath({ ...sampleSchema(), access: 'customer', editable: EDITABLE }, path)).toBe(true);
    expect(paths).toContain('theme.mode');
    expect(paths).toContain('tokens.primary');
    expect(paths).toContain('labels');
    expect(paths).not.toContain('theme.darkSelector');
    expect(paths).not.toContain('theme.lightSelector');
    expect(paths).not.toContain('theme.followPrefersColorScheme');
    expect(paths).not.toContain('customCss');
    expect(form.element.querySelector('textarea.code')).toBeNull();
  });

  it('keeps full tab set and fields for full access', () => {
    const form = renderForm(sampleContext());
    expect(tabNames(form.element)).toHaveLength(11);
    expect(form.element.querySelector('[data-ka11y-path="customCss"]')).not.toBeNull();
  });

  it('prunes an empty panel to nothing', () => {
    const panel = document.createElement('div');
    panel.innerHTML = '<fieldset><div data-ka11y-path="performance.strategy"></div></fieldset>';
    expect(
      pruneToEditable(panel, {
        ...sampleSchema(),
        access: 'customer',
        editable: EDITABLE,
      })
    ).toBe(false);
    expect(panel.querySelector('fieldset')).toBeNull();
  });

  it('mounts the app without calling the trigger probe', async () => {
    const api = fakeApi();
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const app = buildApp(root, sampleConfig(), api, { ...sampleSchema(), access: 'customer', editable: EDITABLE }, sampleDefaults());
    expect(tabNames(root)).toEqual(['Appearance', 'Languages']);
    expect(root.querySelector('.ka11y-trigger-warning')).toBeNull();
    app.destroy();
  });
});
