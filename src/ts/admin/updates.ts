import type { Fetcher } from './api';
import type { AdminConfig } from './types';

export type UpdateChannel = 'stable' | 'beta';

export interface ChannelState {
  channel: UpdateChannel;
  stored: UpdateChannel;
  locked: boolean;
  updaterEnabled: boolean;
  floor: string;
}

export interface ReleaseOption {
  version: string;
  prerelease: boolean;
  url: string;
}

export interface UpdatesApi {
  getChannel: () => Promise<ChannelState>;
  setChannel: (channel: UpdateChannel) => Promise<ChannelState>;
  getReleases: (refresh: boolean) => Promise<ReleaseOption[]>;
}

export const isSameOriginUrl = (url: string, origin: string): boolean => {
  try {
    return new URL(url, origin).origin === origin;
  } catch {
    return false;
  }
};

export const globalFetcher = (): Fetcher | null => {
  const candidate = (window as unknown as { wp?: { apiFetch?: Fetcher } }).wp?.apiFetch;
  return typeof candidate === 'function' ? candidate : null;
};

export const createUpdatesApi = ({ restRoot, nonce }: Pick<AdminConfig, 'restRoot' | 'nonce'>, fetcher: Fetcher): UpdatesApi => {
  const request = <T>(route: string, method: 'GET' | 'POST', data?: unknown): Promise<T> =>
    fetcher<T>({
      url: `${restRoot}${route}`,
      method,
      headers: { 'X-WP-Nonce': nonce },
      ...(data === undefined ? {} : { data }),
    });

  return {
    getChannel: () => request<ChannelState>('update-channel', 'GET'),
    setChannel: (channel) => request<ChannelState>('update-channel', 'POST', { channel }),
    getReleases: async (refresh) => {
      const separator = restRoot.includes('?') ? '&' : '?';
      const route = refresh ? `releases${separator}refresh=true` : 'releases';
      const payload = await request<{ releases: ReleaseOption[] }>(route, 'GET');
      return payload.releases.filter((release) => typeof release.version === 'string' && typeof release.url === 'string');
    },
  };
};
