import type { ChunkName, InlineConfig } from '../shared/types';

export interface StrategyOptions {
  config: InlineConfig;
  warm(): void;
  has(name: ChunkName): boolean;
  inject(name: ChunkName): void;
}

const IDLE_TIMEOUT_MS = 3000;

const IDLE_FALLBACK_MS = 1500;

const EAGER_GRACE_MS = 10_000;

const EAGER_CHUNKS: readonly ChunkName[] = ['kernel', 'panel', 'content', 'color', 'orientation'];

const afterLoadAndIdle = (task: () => void): void => {
  const onIdle = (): void => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    else setTimeout(task, IDLE_FALLBACK_MS);
  };
  if (document.readyState === 'complete') onIdle();
  else addEventListener('load', onIdle, { once: true });
};

export const applyStrategy = ({ config, warm, has, inject }: StrategyOptions): void => {
  const { strategy, prefetch } = config.load;

  const injectMissing = (): void => {
    EAGER_CHUNKS.filter((name) => !has(name)).forEach(inject);
  };

  if (strategy === 'idle' || (strategy === 'interaction' && prefetch === 'idle')) afterLoadAndIdle(warm);
  else if (strategy === 'defer' || strategy === 'async') warm();
  else if (strategy === 'eager') setTimeout(injectMissing, EAGER_GRACE_MS);
};
