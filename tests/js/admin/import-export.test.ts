import {
  downloadSettings,
  importIntro,
  parseSettingsFile,
  parseSettingsText,
  serializeSettings,
  EXPORT_FILENAME,
} from '../../../src/ts/admin/import-export';
import { fakeApi, importOf, sampleDefaults } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

describe('import and export', () => {
  it('round trips settings through a File', async () => {
    const settings = { ...sampleDefaults(), labels: { pl_PL: { open: 'Otworz' } } };
    const file = new File([serializeSettings(settings)], EXPORT_FILENAME, { type: 'application/json' });
    expect(await parseSettingsFile(file)).toEqual(settings);
    const api = fakeApi();
    const dry = await api.importSettings(await parseSettingsFile(file), true);
    expect(api.importSettings).toHaveBeenCalledWith(settings, true);
    expect(dry.settings).toEqual(settings);
  });

  it('rejects invalid files', () => {
    expect(() => parseSettingsText('{nope')).toThrow('The file is not valid JSON.');
    expect(() => parseSettingsText('[1,2]')).toThrow('The file must contain a settings object.');
    expect(() => parseSettingsText('"x"')).toThrow('The file must contain a settings object.');
  });

  it('rejects an unreadable file before any api call', async () => {
    await expect(parseSettingsFile(new File(['{bad'], 'x.json'))).rejects.toThrow('The file is not valid JSON.');
  });

  it('describes the origin of an imported file', () => {
    expect(importIntro(importOf({}))).toContain('version 0.4.0 (settings format 4)');
    expect(importIntro({ ...importOf({}), from: { plugin: null, schemaVersion: 1 } })).toBe('Importing this file changes these settings.');
  });

  it('downloads the exported settings as a JSON file', async () => {
    const createObjectURL = jest.fn(() => 'blob:test');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    const api = fakeApi();
    await downloadSettings(api);
    expect(api.exportSettings).toHaveBeenCalled();
    expect(clicked).toEqual([EXPORT_FILENAME]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
  });
});
