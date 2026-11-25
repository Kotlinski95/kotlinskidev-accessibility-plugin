import { buildApp } from '../../../src/ts/admin/app';
import { buildImportExportPanel } from '../../../src/ts/admin/panels/import-export';
import { change, fakeApi, importOf, previewOf, sampleConfig, sampleContext, sampleDefaults, sampleSchema } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });
jest.mock('@wordpress/api-fetch', () => jest.requireActual('./wp-mocks').apiFetchMock, { virtual: true });

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

const CHANGE = { path: 'storage.key', from: 'ka11y', to: 'abc', source: 'site' };

const dialogButtons = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')];

const editKey = (root: HTMLElement): void => {
  const key = root.querySelector('.ka11y-panel--behavior input[type="text"]') as HTMLInputElement;
  key.value = 'abc';
  change(key);
};

describe('save with change preview', () => {
  const mount = (api = fakeApi()) => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const app = buildApp(root, sampleConfig(), api, sampleSchema(), sampleDefaults());
    return { root, app, api };
  };

  it('lists the edited field and saves only after confirmation', async () => {
    const api = fakeApi({ previewSave: jest.fn().mockResolvedValue(previewOf({}, [CHANGE])) });
    const { root } = mount(api);
    editKey(root);
    (root.querySelector('.ka11y-savebar__save') as HTMLButtonElement).click();
    await flush();
    expect(api.previewSave).toHaveBeenCalled();
    expect(document.querySelectorAll('[role="alertdialog"] tbody tr')).toHaveLength(1);
    expect(document.querySelector('[role="alertdialog"] tbody th')?.textContent).toBe('storage.key');
    expect(api.saveSettings).not.toHaveBeenCalled();
    dialogButtons()[0]?.click();
    await flush();
    expect(api.saveSettings).not.toHaveBeenCalled();
    (root.querySelector('.ka11y-savebar__save') as HTMLButtonElement).click();
    await flush();
    dialogButtons()[1]?.click();
    await flush();
    expect(api.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('saves straight away when the server sees no change', async () => {
    const { root, api } = mount();
    editKey(root);
    (root.querySelector('.ka11y-savebar__save') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(api.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('shows locked paths when the preview is refused', async () => {
    const refusal = { message: 'Some of these settings are locked by site configuration.', data: { status: 409, paths: ['storage.key'] } };
    const { root, api } = mount(fakeApi({ previewSave: jest.fn().mockRejectedValue(refusal) }));
    editKey(root);
    (root.querySelector('.ka11y-savebar__save') as HTMLButtonElement).click();
    await flush();
    expect(root.querySelector('.ka11y-notices')?.textContent).toContain('Locked settings: storage.key.');
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('renders locked fields disabled from the schema', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    buildApp(root, sampleConfig(), fakeApi(), { ...sampleSchema(), locked: ['storage.key'] }, sampleDefaults());
    expect((root.querySelector('[data-ka11y-path="storage.key"] input') as HTMLInputElement).disabled).toBe(true);
  });

  it('finds a setting through the search box', () => {
    const { root } = mount();
    const search = root.querySelector('.ka11y-search__input') as HTMLInputElement;
    search.value = 'stacking';
    change(search);
    expect(root.querySelectorAll('.ka11y-search__result')).toHaveLength(1);
  });
});

describe('import with preview', () => {
  const chooseFile = (panel: HTMLElement, text: string): void => {
    const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([text], 'settings.json', { type: 'application/json' })], configurable: true });
  };
  const importButton = (panel: HTMLElement): HTMLButtonElement =>
    [...panel.querySelectorAll('button')].find((item) => item.textContent === 'Import settings') as HTMLButtonElement;

  it('runs a dry run, shows the changes and the warnings, then imports', async () => {
    const dry = { ...importOf({ storage: { key: 'abc' } }, [CHANGE]), adjusted: ['storage.ttlDays'], locked: ['widget.size'], dropped: ['legacy.key'] };
    const importSettings = jest.fn().mockResolvedValueOnce(dry).mockResolvedValueOnce(importOf({ storage: { key: 'abc' } }, [CHANGE]));
    const ctx = sampleContext(sampleDefaults(), fakeApi({ importSettings }));
    const panel = buildImportExportPanel(ctx);
    document.body.replaceChildren(panel);
    chooseFile(panel, JSON.stringify({ format: 'kotlinskidev-accessibility-settings', settings: {} }));
    importButton(panel).click();
    await flush();
    expect(importSettings).toHaveBeenCalledWith(expect.anything(), true);
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('version 0.4.0');
    expect(dialog.textContent).toContain('Adjusted to a valid value: storage.ttlDays.');
    expect(dialog.textContent).toContain('Ignored unknown settings: legacy.key.');
    expect(ctx.reload).not.toHaveBeenCalled();
    dialogButtons()[1]?.click();
    await flush();
    expect(importSettings).toHaveBeenLastCalledWith(expect.anything(), false);
    expect(ctx.reload).toHaveBeenCalled();
    expect(ctx.state.get('storage.key')).toBe('abc');
  });

  it('imports nothing when the dry run finds no difference', async () => {
    const ctx = sampleContext();
    const panel = buildImportExportPanel(ctx);
    document.body.replaceChildren(panel);
    chooseFile(panel, '{}');
    importButton(panel).click();
    await flush();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(ctx.api.importSettings).toHaveBeenCalledTimes(1);
    expect(ctx.notices.element.textContent).toContain('Nothing to import.');
  });

  it('shows the newer-version error from the server', async () => {
    const error = { message: 'This file was made by a newer version of the plugin.', data: { status: 409 } };
    const ctx = sampleContext(sampleDefaults(), fakeApi({ importSettings: jest.fn().mockRejectedValue(error) }));
    const panel = buildImportExportPanel(ctx);
    document.body.replaceChildren(panel);
    chooseFile(panel, '{}');
    importButton(panel).click();
    await flush();
    expect(ctx.notices.element.textContent).toBe('This file was made by a newer version of the plugin.');
  });

  it('lists locked paths when the server answers 409', async () => {
    const error = { message: 'Some of these settings are locked.', data: { status: 409, paths: ['storage.key'] } };
    const ctx = sampleContext(sampleDefaults(), fakeApi({ importSettings: jest.fn().mockRejectedValue(error) }));
    const panel = buildImportExportPanel(ctx);
    document.body.replaceChildren(panel);
    chooseFile(panel, '{}');
    importButton(panel).click();
    await flush();
    expect(ctx.notices.element.textContent).toBe('Some of these settings are locked. Locked settings: storage.key.');
  });
});
