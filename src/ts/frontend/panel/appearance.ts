import type { PanelConfig } from '../../shared/types';

export const DEFAULT_WIDTH = 448;
export const DEFAULT_ANIMATION_MS = 220;
const CLOSE_RATIO = 160 / 220;

export const panelVariables = (config: PanelConfig): Record<string, string> => {
  const vars: Record<string, string> = {};
  const width = config.width ?? DEFAULT_WIDTH;
  const offset = config.offset ?? 0;
  const duration = config.animationMs ?? DEFAULT_ANIMATION_MS;
  if (width !== DEFAULT_WIDTH) vars['--ka11y-panel-width'] = `${width}px`;
  if (offset > 0) vars['--ka11y-panel-offset'] = `${offset}px`;
  if (duration !== DEFAULT_ANIMATION_MS) {
    vars['--ka11y-open-ms'] = `${duration}ms`;
    vars['--ka11y-close-ms'] = `${Math.round(duration * CLOSE_RATIO)}ms`;
  }
  if (config.backdrop === true) {
    vars['--ka11y-backdrop-color'] = config.backdropColor ?? '#000000';
    vars['--ka11y-backdrop-opacity'] = String((config.backdropOpacity ?? 40) / 100);
    if ((config.backdropBlur ?? 0) > 0) vars['--ka11y-backdrop-filter'] = `blur(${config.backdropBlur}px)`;
  }
  return vars;
};

export const applyPanelAppearance = (host: HTMLElement, panel: HTMLElement, config: PanelConfig): void => {
  Object.entries(panelVariables(config)).forEach(([name, value]) => host.style.setProperty(name, value));
  const animation = config.animation ?? 'slide';
  if (animation === 'slide') panel.removeAttribute('data-animation');
  else panel.dataset.animation = animation;
};

export interface Backdrop {
  element: HTMLElement;
  setOpen(open: boolean): void;
  destroy(): void;
}

export const createBackdrop = (doc: Document, config: PanelConfig, onDismiss: () => void): Backdrop | null => {
  if (config.backdrop !== true) return null;
  const element = doc.createElement('div');
  element.className = 'ka11y-backdrop';
  element.setAttribute('aria-hidden', 'true');
  const onPointerDown = (event: Event): void => {
    event.preventDefault();
    if (config.closeOnBackdrop !== false) onDismiss();
  };
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('mousedown', (event) => event.preventDefault());
  return {
    element,
    setOpen: (open) => element.toggleAttribute('data-open', open),
    destroy: () => element.removeEventListener('pointerdown', onPointerDown),
  };
};
