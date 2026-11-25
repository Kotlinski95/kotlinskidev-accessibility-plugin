import type { KotlinskidevA11yConfig } from '../../shared/types';
import { createElement } from '../dom';
import type { HideToolbar } from '../hide-toolbar';
import type { PanelContext } from './context';
import { iconChildren } from './icons';

export const PANEL_TITLE_ID = 'ka11y-panel-title';
const HIDE_MENU_ID = 'ka11y-hide-menu';

export interface HeaderOptions {
  config: KotlinskidevA11yConfig;
  hideToolbar: HideToolbar;
  onClose(): void;
}

export interface Header {
  element: HTMLElement;
  bar: HTMLElement;
  closeButton: HTMLButtonElement;
}

const buildHideMenu = (ctx: PanelContext, { config, hideToolbar, onClose }: HeaderOptions): HTMLElement[] => {
  const { doc, t } = ctx;
  const menu = createElement(doc, 'div', { class: 'ka11y-hide-menu', id: HIDE_MENU_ID, hidden: true });
  const toggle = createElement(
    doc,
    'button',
    { type: 'button', class: 'ka11y-meta__link ka11y-hide-toggle', 'aria-expanded': 'false', 'aria-controls': HIDE_MENU_ID },
    [t('hideToolbar')]
  );
  const onToggle = (): void => {
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
  };
  ctx.listen(toggle, 'click', onToggle);
  const chip = (text: string, hide: () => void, attributes: Record<string, string> = {}): HTMLButtonElement => {
    const button = createElement(doc, 'button', { type: 'button', class: 'ka11y-chip', ...attributes }, [text]);
    const onChip = (): void => {
      onClose();
      hide();
    };
    ctx.listen(button, 'click', onChip);
    return button;
  };
  menu.append(chip(t('hideToolbarSession'), () => hideToolbar.hideForSession()));
  config.hideToolbar.days.forEach((days) => {
    const text = `${t('hideToolbarDays')} ${days} ${t('hideToolbarDaysUnit')}`;
    menu.append(chip(text, () => hideToolbar.hideForDays(days), { 'data-days': String(days) }));
  });
  return [toggle, menu];
};

export const buildHeader = (ctx: PanelContext, options: HeaderOptions): Header => {
  const { doc, t } = ctx;
  const { config } = options;
  const closeButton = createElement(doc, 'button', { type: 'button', class: 'ka11y-close', 'aria-label': t('close') }, iconChildren(ctx.icon('close')));
  ctx.listen(closeButton, 'click', options.onClose);
  const bar = createElement(doc, 'div', { class: 'ka11y-head__bar' }, [closeButton]);
  const statement =
    config.statementUrl === ''
      ? []
      : [createElement(doc, 'a', { class: 'ka11y-meta__link ka11y-link', href: config.statementUrl }, [t('statementLink')])];
  const hide = config.hideToolbar.allow ? buildHideMenu(ctx, options) : [];
  const [toggle, menu] = hide;
  const metaItems = [...statement, ...(toggle ? [toggle] : [])];
  const meta = metaItems.flatMap((item, index) =>
    index === 0 ? [item] : [createElement(doc, 'span', { 'aria-hidden': 'true' }, ['•']), item]
  );
  const element = createElement(doc, 'header', { class: 'ka11y-head' }, [
    bar,
    createElement(doc, 'span', { class: 'ka11y-head__icon', 'aria-hidden': 'true' }, iconChildren(ctx.icon('access'))),
    createElement(doc, 'h2', { id: PANEL_TITLE_ID, class: 'ka11y-title', tabindex: '-1' }, [t('panelTitle')]),
    ...(meta.length > 0 ? [createElement(doc, 'p', { class: 'ka11y-meta' }, meta)] : []),
    ...(menu ? [menu] : []),
  ]);
  return { element, bar, closeButton };
};
