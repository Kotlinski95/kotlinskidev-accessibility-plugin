import type { APIRequestContext, APIResponse } from '@playwright/test';
import { SETTINGS_PAGE, REST_NAMESPACE } from './env';

export interface SettingsPatch {
  [key: string]: unknown;
}

export interface SettingsClient {
  get(): Promise<SettingsPatch>;
  patch(patch: SettingsPatch): Promise<SettingsPatch>;
  reset(): Promise<void>;
}

const NONCE_PATTERN = /"restRoot":"[^"]*","nonce":"([a-f0-9]+)"/;

const routeFor = (path: string): string => `/?rest_route=/${REST_NAMESPACE}/${path}`;

export const readNonce = async (admin: APIRequestContext): Promise<string> => {
  const response = await admin.get(SETTINGS_PAGE);
  const match = NONCE_PATTERN.exec(await response.text());
  const nonce = match?.[1];
  if (nonce === undefined) throw new Error('REST nonce not found on the settings page');
  return nonce;
};

const parseJson = async (response: APIResponse): Promise<SettingsPatch> => {
  if (!response.ok()) throw new Error(`Settings request failed with status ${response.status()}`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) throw new Error('Unexpected settings response');
  return body as SettingsPatch;
};

export const createSettingsClient = async (admin: APIRequestContext): Promise<SettingsClient> => {
  const nonce = await readNonce(admin);
  const headers = { 'X-WP-Nonce': nonce };

  const get = async (): Promise<SettingsPatch> => parseJson(await admin.get(routeFor('settings'), { headers }));

  const patch = async (value: SettingsPatch): Promise<SettingsPatch> =>
    parseJson(await admin.post(routeFor('settings'), { headers, data: value }));

  const reset = async (): Promise<void> => {
    await parseJson(await admin.post(routeFor('reset'), { headers }));
  };

  return { get, patch, reset };
};

export const settingsRoute = (path: string): string => routeFor(path);
