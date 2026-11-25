import type { FeatureChunk, KernelApi, KernelExports } from '../frontend/kernel';
import type { GroupName, InlineConfig } from '../shared/types';
import { attachRuntime, createChunkLoader } from './chunks';
import { whenDeviceVisible } from './device';
import { installApi } from './api';
import { ensureShadow } from './dsd';
import { mountLauncher } from './launcher';
import { createPanelFlow } from './open';
import { installQueue } from './queue';
import { createRouter } from './router';
import { applyStrategy } from './strategy';
import { bindTriggers, wireAria } from './triggers';

declare const __KA11Y_GROUPS__: Record<string, GroupName>;

export interface StartOptions {
  nonce?: string;
  cfasync?: string | null;
  groups?: Record<string, GroupName>;
}

const ROUTED_ACTIONS = ['open', 'close', 'toggle', 'reset', 'feature', 'profile', 'statement', 'hide', 'show', 'trigger'];

const noop = (): void => undefined;


const scriptOptions = (): StartOptions => {
  const script = document.currentScript;
  return script instanceof HTMLScriptElement ? { nonce: script.nonce, cfasync: script.getAttribute('data-cfasync') } : {};
};

export const startLoader = (options: StartOptions = scriptOptions()): void => {
  const config = window.kotlinskidevA11y as unknown as InlineConfig | undefined;
  if (!config || window.kotlinskidevA11yOff) return;
  const groups = {
    __proto__: null,
    ...(options.groups || (typeof __KA11Y_GROUPS__ === 'undefined' ? {} : __KA11Y_GROUPS__)),
  } as unknown as Record<string, GroupName>;
  const hiddenKey = config.hk || `${config.storage.key}-hidden`;

  const runtime = (window.kotlinskidevA11yRuntime = window.kotlinskidevA11yRuntime || { s: [], c: [] });
  const chunks = createChunkLoader(config, options.nonce || '', options.cfasync || null);
  attachRuntime(chunks.register);

  const ensureKernel = (): Promise<KernelApi> =>
    chunks.once('boot', async () => {
      const exports = (await chunks.load('kernel', 'high')) as KernelExports;
      return exports.bootKernel({ config, groupOf: (key) => groups[key] || null, loadGroup, getData: () => chunks.fetchData() });
    });

  const loadGroup = (name: GroupName): Promise<void> =>
    chunks.once(`g${name}`, async () => {
      const [api, chunk] = await Promise.all([ensureKernel(), chunks.load(name, 'high')]);
      api.addFeatures(chunk as FeatureChunk);
    });

  if (runtime.s.length > 0) {
    const saved = new Set<GroupName>();
    runtime.s.forEach((key) => groups[key] && saved.add(groups[key] as GroupName));
    Promise.all([ensureKernel(), ...[...saved].map(loadGroup)]).catch(noop);
  }

  const warm = (): void => {
    chunks.load('kernel', 'low').catch(noop);
    chunks.load('panel', 'low').catch(noop);
    chunks.fetchData().catch(noop);
  };

  const onReady = (): void => {
    const host = document.getElementById('ka11y-root');
    if (!host) return;
    ensureShadow(host);
    mountLauncher(config, host);
    const flow = createPanelFlow({ config, host, chunks, ensureKernel });
    const route = createRouter({ config, host, chunks, hiddenKey, dialog: flow, ensureKernel });
    const queue = installQueue(Object.fromEntries(ROUTED_ACTIONS.map((name) => [name, route])));
    const push = (command: Parameters<typeof route>[0]): void => void queue.push(command);
    wireAria(config);
    installApi({ config, push, ensureKernel, isOpen: flow.isOpen });
    const inject = (name: Parameters<typeof chunks.has>[0]): void => void chunks.load(name, 'low').catch(noop);
    whenDeviceVisible(config, () => {
      bindTriggers({ config, host, push, prefetch: warm, hiddenKey });
      applyStrategy({ config, warm, has: chunks.has, inject });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();
};

startLoader();
