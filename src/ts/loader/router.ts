import type { KernelApi } from '../frontend/kernel';
import type { InlineConfig, KA11yCommand, KA11yQueue } from '../shared/types';
import type { ChunkLoader } from './chunks';
import { actionName } from './queue';
import { ACTION_HASH, isHidden, setToolbarHidden, resolveTrigger, showToolbar } from './triggers';

export interface RouterOptions {
  config: InlineConfig;
  host: HTMLElement;
  chunks: ChunkLoader;
  hiddenKey: string;
  dialog(command: KA11yCommand): void;
  ensureKernel(): Promise<KernelApi>;
}

interface RunnableKernel {
  run?(command: KA11yCommand): Promise<void>;
}

const DEFAULT_URL_ACTIONS = ['open', 'feature', 'profile'];

const KERNEL_ACTIONS = ['reset', 'feature', 'profile'];

const noop = (): void => undefined;

export const createRouter = ({ config, host, chunks, hiddenKey, dialog, ensureKernel }: RouterOptions): ((command: KA11yCommand) => void) => {
  const urlActions = config.triggers?.u ?? DEFAULT_URL_ACTIONS;

  return (command) => {
    const name = actionName(command);
    if (command.source === 'url') {
      const url = new URL(location.href);
      url.searchParams.delete('ka11y');
      if (url.hash.startsWith(ACTION_HASH)) url.hash = '';
      history.replaceState(null, '', url);
      if (!urlActions.includes(name)) return;
    }
    if (name === 'trigger') {
      const action = resolveTrigger(command.opener, config);
      if (action) (window.kotlinskidevA11yQueue as KA11yQueue).push({ ...command, action, source: 'trigger' });
    } else if (name === 'hide') {
      setToolbarHidden(host, hiddenKey, true);
      dialog({ action: 'close', source: 'api' });
    } else if (name === 'show') showToolbar(host, hiddenKey);
    else if (name === 'statement') {
      chunks
        .fetchData()
        .then(({ statementUrl }) => statementUrl && /^https?:$/.test(new URL(statementUrl, location.href).protocol) && location.assign(statementUrl))
        .catch(noop);
    } else if (KERNEL_ACTIONS.includes(name)) ensureKernel().then((kernel) => void (kernel as RunnableKernel).run?.(command), noop);
    else if (!(config.hiddenMedia && matchMedia(config.hiddenMedia).matches)) {
      if (name !== 'close' && command.source !== 'launcher' && isHidden()) showToolbar(host, hiddenKey);
      dialog(command);
    }
  };
};
