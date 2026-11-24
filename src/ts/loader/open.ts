import type { Dialog } from '../frontend/a11y-dialog';
import type { PanelChunk } from '../frontend/chunks/panel';
import type { KernelApi } from '../frontend/kernel';
import type { InlineConfig, KA11yCommand } from '../shared/types';
import type { ChunkLoader } from './chunks';
import { ensureShadow, launcherOf } from './dsd';
import { actionName } from './queue';

export interface PanelFlowOptions {
  config: InlineConfig;
  host: HTMLElement;
  chunks: ChunkLoader;
  ensureKernel(): Promise<KernelApi>;
}

const noop = (): void => undefined;

const DEFAULT_LOAD_ERROR = 'Try again';

type DialogAction = 'open' | 'close' | 'toggle';

export const createPanelFlow = ({ config, host, chunks, ensureKernel }: PanelFlowOptions): ((command: KA11yCommand) => void) => {
  let started = false;
  let mounted = false;

  const setLabel = (label: string): void => {
    const launcher = launcherOf(host);
    if (launcher) launcher.setAttribute('aria-label', label);
  };

  const mountPanel = async (): Promise<Dialog> => {
    const [kernel, panel, data] = await Promise.all([
      ensureKernel(),
      chunks.load('panel', 'high') as Promise<PanelChunk>,
      chunks.fetchData(),
    ]);
    kernel.ensurePageCss();
    const merged = { ...config, ...data, strings: { ...config.strings, ...data.strings } };
    return panel.mount({ kernel, config: merged, data, host, shadow: ensureShadow(host) }).dialog;
  };

  const onMounted = (): void => {
    mounted = true;
    delete host.dataset.state;
  };

  const onFailed = (error: unknown): void => {
    started = false;
    mounted = false;
    host.dataset.state = 'error';
    setLabel(config.strings.loadError || DEFAULT_LOAD_ERROR);
    console.warn('[kotlinskidev-a11y]', String(error));
  };

  const begin = (): void => {
    started = true;
    if (host.dataset.state === 'error') setLabel(config.strings.open as string);
    host.dataset.state = 'loading';
    chunks.once('mount', mountPanel).then(onMounted, onFailed);
  };

  return (command) => {
    const action = actionName(command) as DialogAction;
    if (mounted && command.source === 'launcher') return;
    if (!started && action === 'close') return;
    if (!started) begin();
    chunks.once('mount', mountPanel).then((dialog) => (action === 'close' ? dialog.close() : dialog[action](command.opener)), noop);
  };
};
