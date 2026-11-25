import type { KotlinskidevA11yConfig } from '../../shared/types';
import { createElement } from '../dom';
import type { PanelContext } from './context';

export const buildFooter = (ctx: PanelContext, config: KotlinskidevA11yConfig): HTMLElement => {
  const { doc, t } = ctx;
  const status = createElement(doc, 'p', { class: 'ka11y-sr', role: 'status' });
  const reset = createElement(doc, 'button', { type: 'button', class: 'ka11y-reset' }, [t('resetSettings')]);
  const onReset = (): void => {
    ctx.store.reset();
    status.textContent = t('resetDone');
  };
  ctx.listen(reset, 'click', onReset);
  return createElement(doc, 'footer', { class: 'ka11y-foot' }, [
    reset,
    ...(config.shortcut.enabled ? [createElement(doc, 'p', { class: 'ka11y-hint' }, [`${t('shortcutHint')}: ${config.shortcut.combo}`])] : []),
    status,
  ]);
};
