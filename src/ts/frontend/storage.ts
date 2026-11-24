import type { FeatureLevel, SavedState, StorageConfig } from '../shared/types';
import type { StoreState } from './store';

export interface LoadedState {
  classes: Set<string>;
  vars: Record<string, string>;
  levels: Record<string, FeatureLevel>;
}

export interface StateStorage {
  load(): LoadedState | null;
  save(state: StoreState): void;
}

const DAY_MS = 86_400_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readCookie = (key: string): string | null => {
  const prefix = `${key}=`;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
};

const writeCookie = (key: string, value: string, expires: number): void => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${key}=${encodeURIComponent(value)}; expires=${new Date(expires).toUTCString()}; path=/; SameSite=Lax${secure}`;
};

const clearCookie = (key: string): void => {
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};

const pickStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const pickVars = (value: unknown): Record<string, string> => {
  const vars: Record<string, string> = {};
  if (!isRecord(value)) return vars;
  Object.entries(value).forEach(([name, item]) => {
    if (typeof item === 'string' && name.startsWith('--ka11y-')) vars[name] = item;
  });
  return vars;
};

const pickLevels = (value: unknown): Record<string, FeatureLevel> => {
  const levels: Record<string, FeatureLevel> = {};
  if (!isRecord(value)) return levels;
  Object.entries(value).forEach(([name, item]) => {
    if (typeof item === 'boolean' || typeof item === 'number') levels[name] = item;
  });
  return levels;
};

const parse = (raw: string): LoadedState | null => {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  return {
    classes: new Set(pickStrings(data.classes).filter((name) => name.startsWith('ka11y-'))),
    vars: pickVars(data.vars),
    levels: pickLevels(data.levels),
  };
};

const isEmpty = (state: StoreState): boolean =>
  state.classes.size === 0 && Object.keys(state.vars).length === 0 && Object.keys(state.levels).length === 0;

export const createStorage = (config: StorageConfig): StateStorage => {
  let lastSerialized = '';

  const readRaw = (): string | null =>
    config.mode === 'cookie' ? readCookie(config.key) : localStorage.getItem(config.key);

  const load = (): LoadedState | null => {
    if (config.mode === 'none') return null;
    try {
      const raw = readRaw();
      return raw ? parse(raw) : null;
    } catch {
      return null;
    }
  };

  const remove = (): void => {
    if (config.mode === 'cookie') clearCookie(config.key);
    else localStorage.removeItem(config.key);
  };

  const save = (state: StoreState): void => {
    if (config.mode === 'none') return;
    const body = {
      classes: [...state.classes],
      vars: state.vars,
      levels: state.levels,
    };
    const serialized = JSON.stringify(body);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    try {
      if (isEmpty(state)) {
        remove();
        return;
      }
      const expires = Date.now() + config.ttlDays * DAY_MS;
      const payload: SavedState = { ...body, exp: expires };
      const raw = JSON.stringify(payload);
      if (config.mode === 'cookie') writeCookie(config.key, raw, expires);
      else localStorage.setItem(config.key, raw);
    } catch {
      lastSerialized = '';
    }
  };

  return { load, save };
};
