import { panelSpecs, renderForm } from '../../../src/ts/admin/form-renderer';
import { buildApp, mountAdmin } from '../../../src/ts/admin/app';
import { change, fakeApi, previewOf, sampleConfig, sampleContext, sampleDefaults, sampleSchema } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });
jest.mock('@wordpress/api-fetch', () => jest.requireActual('./wp-mocks').apiFetchMock, { virtual: true });

const CHANGE = { path: 'storage.key', from: 'changed', to: 'ka11y', source: 'default' };

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('form renderer', () => {
  it('builds every tab from the sample schema', () => {
    const ctx = sampleContext();
    const form = renderForm(ctx);
    document.body.replaceChildren(form.element);
    const ids = panelSpecs().map((spec) => spec.id);
    expect(ids).toEqual(['general', 'features', 'profiles', 'visibility', 'appearance', 'languages', 'behavior', 'triggers', 'performance', 'maintenance', 'import-export']);
    expect(form.buttons).toHaveLength(11);
    expect(form.element.querySelectorAll(':scope > [role="tabpanel"]')).toHaveLength(11);
    for (const spec of panelSpecs()) {
      const panel = spec.build(ctx);
      expect(panel.children.length).toBeGreaterThan(0);
    }
  });

  it('general tab covers position, size, icon and border', () => {
    const form = renderForm(sampleContext());
    const general = form.element.querySelector('.ka11y-panel--general') as HTMLElement;
    expect(general.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(general.querySelector('legend')?.textContent).toBe('Widget position per device');
    expect(general.querySelector('.ka11y-field--media')).not.toBeNull();
    expect(general.querySelectorAll('select').length).toBe(4);
  });

  it('features tab groups features and offers level defaults', () => {
    const form = renderForm(sampleContext());
    const features = form.element.querySelector('.ka11y-panel--features') as HTMLElement;
    expect(features.querySelectorAll('h3')).toHaveLength(3);
    expect(features.querySelectorAll('tbody tr')).toHaveLength(26);
    const select = features.querySelector('select[aria-label="Default state of Bigger text"]') as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual(['Off', 'Level 1: Low', 'Level 2: Medium', 'Level 3: High']);
  });

  it('profiles tab renders an editable feature list per profile', () => {
    const ctx = sampleContext();
    const form = renderForm(ctx);
    const profiles = form.element.querySelector('.ka11y-panel--profiles') as HTMLElement;
    expect(profiles.querySelectorAll('.ka11y-profile')).toHaveLength(2);
    const box = profiles.querySelector('.ka11y-checklist input[value="lineHeight"]') as HTMLInputElement;
    box.checked = true;
    change(box, 'change');
    expect(ctx.state.get('profiles.visionImpaired.features')).toEqual(['biggerText', 'lineHeight']);
  });

  it('visibility, appearance, languages and behavior tabs expose their fields', () => {
    const ctx = sampleContext();
    const form = renderForm(ctx);
    const root = form.element;
    expect(root.querySelectorAll('.ka11y-panel--visibility .ka11y-field--list')).toHaveLength(10);
    expect(root.querySelectorAll('.ka11y-panel--appearance .ka11y-field--color')).toHaveLength(12);
    expect(root.querySelector('.ka11y-panel--appearance textarea')).not.toBeNull();
    expect(root.querySelectorAll('.ka11y-panel--languages .ka11y-field--locale-map')).toHaveLength(2);
    expect(root.querySelector('.ka11y-panel--behavior .ka11y-gdpr')).not.toBeNull();
    expect(root.querySelector('.ka11y-panel--behavior .ka11y-combo')).not.toBeNull();
  });

  it('import-export tab resets through an in-DOM confirm dialog', async () => {
    const api = fakeApi({ previewReset: jest.fn().mockResolvedValue(previewOf(sampleDefaults(), [CHANGE])) });
    const ctx = sampleContext(sampleDefaults(), api);
    ctx.state.set('storage.key', 'changed');
    const form = renderForm(ctx);
    document.body.replaceChildren(form.element);
    const reset = [...form.element.querySelectorAll('button')].find((item) => item.textContent === 'Reset to defaults') as HTMLButtonElement;
    const confirmSpy = jest.spyOn(window, 'confirm');
    reset.click();
    await flush();
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Your 1 unsaved change will be lost.');
    expect(dialog.querySelectorAll('tbody tr')).toHaveLength(1);
    const buttons = dialog.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();
    await flush();
    expect(api.resetSettings).toHaveBeenCalled();
    expect(ctx.reload).toHaveBeenCalled();
    expect(ctx.state.isDirty()).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('cancelling the dialog keeps settings', async () => {
    const api = fakeApi({ previewReset: jest.fn().mockResolvedValue(previewOf(sampleDefaults(), [CHANGE])) });
    const ctx = sampleContext(sampleDefaults(), api);
    const form = renderForm(ctx);
    document.body.replaceChildren(form.element);
    const reset = [...form.element.querySelectorAll('button')].find((item) => item.textContent === 'Reset to defaults') as HTMLButtonElement;
    reset.click();
    await flush();
    (document.querySelector('[role="alertdialog"] button') as HTMLButtonElement).click();
    await flush();
    expect(api.resetSettings).not.toHaveBeenCalled();
  });
});

describe('admin app', () => {
  it('tracks dirty state, saves and announces success', async () => {
    const api = fakeApi();
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const app = buildApp(root, sampleConfig(), api, sampleSchema(), sampleDefaults());
    const save = root.querySelector('.ka11y-savebar__save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const key = root.querySelector('.ka11y-panel--behavior input[type="text"]') as HTMLInputElement;
    key.value = 'abc';
    change(key);
    expect(app.state.isDirty()).toBe(true);
    expect(save.disabled).toBe(false);
    expect(root.querySelector('.ka11y-savebar__status')?.textContent).toBe('You have 1 unsaved change.');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    await app.save();
    expect(api.saveSettings).toHaveBeenCalled();
    expect(app.state.isDirty()).toBe(false);
    const live = root.querySelector('[role="status"].ka11y-notices') as HTMLElement;
    expect(live.textContent).toContain('Settings saved.');
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    app.destroy();
  });

  it('warns after saving color pairs below the minimum contrast', async () => {
    const api = fakeApi();
    const root = document.createElement('div');
    const app = buildApp(root, sampleConfig(), api, sampleSchema(), sampleDefaults());
    app.state.set('tokens.onHeader', '#16181e');
    await app.save();
    expect(api.saveSettings).toHaveBeenCalled();
    expect(root.querySelector('.notice-warning')?.textContent).toContain('Header text on Header background');
    expect(root.querySelector('.notice-success')).toBeNull();
    app.destroy();
  });

  it('reports save failures', async () => {
    const api = fakeApi({ saveSettings: jest.fn().mockRejectedValue({ message: 'Nope' }) });
    const root = document.createElement('div');
    const app = buildApp(root, sampleConfig(), api, sampleSchema(), sampleDefaults());
    app.state.set('storage.key', 'x');
    await app.save();
    expect(root.querySelector('.notice-error')?.textContent).toContain('Nope');
    expect(app.state.isDirty()).toBe(true);
    app.destroy();
  });

  it('mounts from the api and shows an error when loading fails', async () => {
    const root = document.createElement('div');
    const app = await mountAdmin(root, sampleConfig(), fakeApi());
    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
    app?.destroy();
    const failing = document.createElement('div');
    expect(await mountAdmin(failing, sampleConfig(), fakeApi({ getSchema: jest.fn().mockRejectedValue(new Error('down')) }))).toBeNull();
    expect(failing.querySelector('.notice-error')?.textContent).toContain('down');
  });
});
