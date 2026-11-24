import { __ } from '@wordpress/i18n';
import type { Api } from './api';
import { isRecord } from './dom';
import type { SettingsTree } from './types';

export const EXPORT_FILENAME = 'kotlinskidev-accessibility-settings.json';

export const serializeSettings = (settings: SettingsTree): string => JSON.stringify(settings, null, 2);

export const readFileText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const onLoad = (): void => resolve(typeof reader.result === 'string' ? reader.result : '');
    const onError = (): void => reject(new Error(__('The file could not be read.', 'kotlinskidev-accessibility')));
    reader.addEventListener('load', onLoad);
    reader.addEventListener('error', onError);
    reader.readAsText(file);
  });

export const parseSettingsText = (text: string): SettingsTree => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(__('The file is not valid JSON.', 'kotlinskidev-accessibility'));
  }
  if (!isRecord(parsed)) throw new Error(__('The file must contain a settings object.', 'kotlinskidev-accessibility'));
  return parsed;
};

export const parseSettingsFile = async (file: Blob): Promise<SettingsTree> => parseSettingsText(await readFileText(file));

export const downloadSettings = async (api: Api, doc: Document = document): Promise<void> => {
  const settings = await api.exportSettings();
  const blob = new Blob([serializeSettings(settings)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = EXPORT_FILENAME;
  doc.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const importSettingsFile = async (api: Api, file: Blob): Promise<SettingsTree> =>
  api.importSettings(await parseSettingsFile(file));
