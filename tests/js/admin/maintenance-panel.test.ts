import { renderForm } from '../../../src/ts/admin/form-renderer';
import { applyLockedState, failureMessage, lockedPathsOf } from '../../../src/ts/admin/locks';
import { buildMaintenancePanel } from '../../../src/ts/admin/panels/maintenance';
import { change, sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

describe('maintenance tab', () => {
  it('holds the uninstall card with the keep-data toggle', () => {
    const ctx = sampleContext();
    const panel = buildMaintenancePanel(ctx);
    const toggle = panel.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(panel.querySelector('h3')?.textContent).toBe('Uninstall');
    expect(toggle.checked).toBe(false);
    expect(toggle.getAttribute('aria-describedby')).not.toBeNull();
    toggle.checked = true;
    change(toggle, 'change');
    expect(ctx.state.get('maintenance.keepDataOnUninstall')).toBe(true);
  });

  it('is the only tab that renders the uninstall setting', () => {
    const form = renderForm(sampleContext());
    expect(form.element.querySelectorAll('[data-ka11y-path="maintenance.keepDataOnUninstall"]')).toHaveLength(1);
    expect(form.element.querySelector('.ka11y-panel--maintenance [data-ka11y-path="maintenance.keepDataOnUninstall"]')).not.toBeNull();
  });
});

describe('per-tab reset button', () => {
  it('is offered on every tab except import and export', () => {
    const form = renderForm(sampleContext());
    const panels = [...form.element.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    const withReset = panels.filter((panel) => panel.querySelector('.ka11y-tab-reset') !== null).map((panel) => panel.dataset.ka11yTab);
    expect(withReset).toHaveLength(10);
    expect(withReset).not.toContain('import-export');
  });

  it('asks for a dry run with the tab paths', async () => {
    const ctx = sampleContext();
    const form = renderForm(ctx);
    document.body.replaceChildren(form.element);
    const button = [...form.element.querySelectorAll('button')].find((item) => item.textContent === 'Reset the Appearance tab') as HTMLButtonElement;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.api.previewReset).toHaveBeenCalledWith(['theme', 'tokens', 'panel', 'customCss']);
    expect(ctx.api.resetSettings).not.toHaveBeenCalled();
    expect(ctx.notices.element.textContent).toBe('The Appearance tab already uses its default values.');
  });
});

describe('locked settings', () => {
  it('disables locked controls, explains why and leaves others alone', () => {
    const ctx = { ...sampleContext(), locked: new Set(['storage.key', 'widget.size', 'features.biggerText.enabled']) };
    const form = renderForm(ctx);
    document.body.replaceChildren(form.element);
    const key = form.element.querySelector('[data-ka11y-path="storage.key"]') as HTMLElement;
    const input = key.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(key.textContent).toContain('Locked by site configuration');
    expect(input.getAttribute('aria-describedby')).toContain(key.querySelector('.ka11y-locked')?.id ?? 'missing');
    const bare = form.element.querySelector('select[data-ka11y-path="features.biggerText.enabled"], input[data-ka11y-path="features.biggerText.enabled"]') as HTMLInputElement;
    expect(bare.disabled).toBe(true);
    expect(bare.nextElementSibling?.className).toContain('screen-reader-text');
    expect((form.element.querySelector('[data-ka11y-path="storage.ttlDays"] input') as HTMLInputElement).disabled).toBe(false);
  });

  it('does nothing without locks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input data-ka11y-path="a.b">';
    applyLockedState(root, new Set());
    expect((root.firstElementChild as HTMLInputElement).disabled).toBe(false);
  });

  it('reads locked paths from a 409 error', () => {
    const error = { code: 'kotlinskidev_a11y_locked', message: 'Some are locked.', data: { status: 409, paths: ['a.b', 'c.d'] } };
    expect(lockedPathsOf(error)).toEqual(['a.b', 'c.d']);
    expect(lockedPathsOf(new Error('x'))).toEqual([]);
    expect(failureMessage(error, 'fallback')).toBe('Some are locked. Locked settings: a.b, c.d.');
    expect(failureMessage({}, 'fallback')).toBe('fallback');
  });
});
