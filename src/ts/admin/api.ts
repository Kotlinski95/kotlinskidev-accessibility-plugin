import apiFetch from '@wordpress/api-fetch';
import type { ApiFetchOptions } from '@wordpress/api-fetch';
import type { AdminConfig, SchemaPayload, SettingsTree } from './types';

export type Fetcher = <T>(options: ApiFetchOptions) => Promise<T>;

export interface Api {
  getSettings: () => Promise<SettingsTree>;
  saveSettings: (settings: SettingsTree) => Promise<SettingsTree>;
  getSchema: () => Promise<SchemaPayload>;
  exportSettings: () => Promise<SettingsTree>;
  importSettings: (settings: SettingsTree) => Promise<SettingsTree>;
  resetSettings: () => Promise<SettingsTree>;
}

export const createApi = ({ restRoot, nonce }: Pick<AdminConfig, 'restRoot' | 'nonce'>, fetcher: Fetcher = apiFetch): Api => {
  const request = <T>(route: string, method: 'GET' | 'POST', data?: unknown): Promise<T> =>
    fetcher<T>({
      url: `${restRoot}${route}`,
      method,
      headers: { 'X-WP-Nonce': nonce },
      ...(data === undefined ? {} : { data }),
    });

  return {
    getSettings: () => request<SettingsTree>('settings', 'GET'),
    saveSettings: (settings) => request<SettingsTree>('settings', 'POST', settings),
    getSchema: () => request<SchemaPayload>('schema', 'GET'),
    exportSettings: () => request<SettingsTree>('export', 'GET'),
    importSettings: (settings) => request<SettingsTree>('import', 'POST', settings),
    resetSettings: () => request<SettingsTree>('reset', 'POST', {}),
  };
};
