import type { KernelExports } from '../frontend/kernel';
import { RUNTIME_ABI } from '../shared/runtime';
import type { ChunkName, ChunkRecord, InlineConfig, PanelData } from '../shared/types';

export type FetchPriority = 'high' | 'low';

export interface ChunkLoader {
  register(...records: ChunkRecord[]): number;
  has(name: ChunkName): boolean;
  load(name: ChunkName, priority: FetchPriority): Promise<unknown>;
  fetchData(): Promise<PanelData>;
  once<T>(key: string, produce: () => Promise<T>): Promise<T>;
}

const RETRY_DELAY_MS = 1000;

const LOAD_TIMEOUT_MS = 15_000;

export const createChunkLoader = (config: InlineConfig, nonce: string, cfasync: string | null): ChunkLoader => {
  const records = new Map<string, ChunkRecord>();
  const memoized = new Map<string, Promise<unknown>>();

  const memo = <T>(key: string, produce: () => Promise<T>): Promise<T> => {
    let promise = memoized.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = produce();
      memoized.set(key, promise);
      promise.catch(() => memoized.delete(key));
    }
    return promise;
  };

  const register = (...incoming: ChunkRecord[]): number => {
    incoming.forEach((record) => {
      if (record[1] === RUNTIME_ABI && !records.has(record[0])) records.set(record[0], record);
    });
    return records.size;
  };

  const inject = (name: string, url: string, priority: FetchPriority): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.nonce = nonce;
      script.setAttribute('fetchpriority', priority);
      if (cfasync !== null) script.setAttribute('data-cfasync', cfasync);
      const onFailure = (): void => {
        clearTimeout(timer);
        script.remove();
        reject(new Error(name));
      };
      const timer = setTimeout(onFailure, LOAD_TIMEOUT_MS);
      script.onload = (): void => {
        clearTimeout(timer);
        if (records.has(name)) resolve();
        else onFailure();
      };
      script.onerror = onFailure;
      document.head.append(script);
    });

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchRecord = (name: ChunkName, priority: FetchPriority): Promise<void> => {
    const url = `${config.chunks.base}${name}.js?ver=${config.chunks.ver[name]}`;
    const retry = (): Promise<void> => sleep(RETRY_DELAY_MS).then(() => inject(name, `${url}&retry=1`, priority));
    return records.has(name) ? Promise.resolve() : inject(name, url, priority).catch(retry);
  };

  const load = (name: ChunkName, priority: FetchPriority): Promise<unknown> =>
    memo(name, async () => {
      const [, kernel] = await Promise.all([
        fetchRecord(name, priority),
        name === 'kernel' ? undefined : load('kernel', priority),
      ]);
      return (records.get(name) as ChunkRecord)[2](kernel as KernelExports | undefined);
    });

  const getJson = async (url: string | undefined): Promise<PanelData> => {
    const response = await fetch(url as string, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(url);
    return (await response.json()) as PanelData;
  };

  const fetchData = (): Promise<PanelData> =>
    memo('data', async () => {
      try {
        return await getJson(config.data[0]);
      } catch {
        return getJson(config.data[1]);
      }
    });

  return { register, has: (name) => records.has(name), load, fetchData, once: memo };
};

export const attachRuntime = (register: ChunkLoader['register']): void => {
  const runtime = (window.kotlinskidevA11yRuntime = window.kotlinskidevA11yRuntime || { s: [], c: [] });
  const pending = runtime.c;
  runtime.c = { push: register };
  if (Array.isArray(pending)) register(...pending);
};
