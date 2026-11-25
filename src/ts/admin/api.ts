import apiFetch from '@wordpress/api-fetch';
import type { ApiFetchOptions } from '@wordpress/api-fetch';
import type { AdminConfig, ImportResult, PreviewResult, SchemaPayload, SettingsTree } from './types';

export type Fetcher = <T>(options: ApiFetchOptions) => Promise<T>;

export interface Api {
  getSettings: () => Promise<SettingsTree>;
  saveSettings: (settings: SettingsTree) => Promise<SettingsTree>;
  previewSave: (settings: SettingsTree) => Promise<PreviewResult>;
  getSchema: () => Promise<SchemaPayload>;
  exportSettings: () => Promise<SettingsTree>;
  importSettings: (body: SettingsTree, dryRun: boolean) => Promise<ImportResult>;
  resetSettings: (paths?: readonly string[]) => Promise<SettingsTree>;
  previewReset: (paths?: readonly string[]) => Promise<PreviewResult>;
}

const resetBody = (paths: readonly string[]): { paths?: readonly string[] } => (paths.length === 0 ? {} : { paths });

export const createApi = ({ restRoot, nonce }: Pick<AdminConfig, 'restRoot' | 'nonce'>, fetcher: Fetcher = apiFetch): Api => {
  const dryRunSuffix = `${restRoot.includes('?') ? '&' : '?'}dry_run=true`;

  const request = <T>(route: string, method: 'GET' | 'POST', data?: unknown, dryRun = false): Promise<T> =>
    fetcher<T>({
      url: `${restRoot}${route}${dryRun ? dryRunSuffix : ''}`,
      method,
      headers: { 'X-WP-Nonce': nonce },
      ...(data === undefined ? {} : { data }),
    });

  return {
    getSettings: () => request<SettingsTree>('settings', 'GET'),
    saveSettings: (settings) => request<SettingsTree>('settings', 'POST', settings),
    previewSave: (settings) => request<PreviewResult>('settings', 'POST', settings, true),
    getSchema: () => request<SchemaPayload>('schema', 'GET'),
    exportSettings: () => request<SettingsTree>('export', 'GET'),
    importSettings: (body, dryRun) => request<ImportResult>('import', 'POST', body, dryRun),
    resetSettings: (paths = []) => request<SettingsTree>('reset', 'POST', resetBody(paths)),
    previewReset: (paths = []) => request<PreviewResult>('reset', 'POST', resetBody(paths), true),
  };
};
