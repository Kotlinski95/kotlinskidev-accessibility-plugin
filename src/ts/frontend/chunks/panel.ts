import type { KotlinskidevA11yConfig } from '../../shared/types';
import type { PanelData } from '../../shared/types';
import type { Dialog } from '../a11y-dialog';
import { createHideToolbar } from '../hide-toolbar';
import type { KernelApi } from '../kernel';
import { createPanel } from '../panel';
import { resolveHost } from '../root';
import { injectShadowStyles } from '../styles';
import { createThemeResolver } from '../theme';

export interface PanelMountOptions {
  kernel: KernelApi;
  config: KotlinskidevA11yConfig;
  data: PanelData;
  host: HTMLElement;
  shadow: ShadowRoot;
}

export interface PanelChunk {
  mount(options: PanelMountOptions): { dialog: Dialog };
}

const PANEL_TOKEN_PROPERTIES: ReadonlyArray<readonly [keyof PanelData['tokens'], string]> = [
  ['primaryDark', '--ka11y-primary-dark'],
  ['onPrimaryDark', '--ka11y-on-primary-dark'],
  ['headerBg', '--ka11y-header-bg'],
  ['onHeader', '--ka11y-on-header'],
  ['canvasLight', '--ka11y-canvas-light'],
  ['canvasDark', '--ka11y-canvas-dark'],
];

const applyPanelTokens = (host: HTMLElement, tokens: PanelData['tokens']): void => {
  PANEL_TOKEN_PROPERTIES.forEach(([key, property]) => host.style.setProperty(property, String(tokens[key])));
};

export const mount = ({ kernel, config, data, host, shadow }: PanelMountOptions): { dialog: Dialog } => {
  resolveHost(document, config);
  injectShadowStyles(shadow, document, data.customCss);
  createThemeResolver({ host, config: config.theme });
  if (kernel.profiles() === null) kernel.attachData(data);
  const profiles = kernel.profiles();
  if (profiles === null) throw new Error('kotlinskidev-a11y: profiles unavailable');
  const hideToolbar = createHideToolbar({ host, key: config.storage.key });
  applyPanelTokens(host, data.tokens);
  const { dialog } = createPanel({ config, store: kernel.store, profiles, hideToolbar, host, shadow, sheetQuery: data.layout.sheetQuery, data });
  return { dialog };
};
