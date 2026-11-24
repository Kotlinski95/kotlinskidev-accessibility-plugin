import { h, uid } from './dom';

export interface TabSpec {
  id: string;
  label: string;
  panel: HTMLElement;
}

export interface TabsOptions {
  label: string;
  initial?: string;
  onSelect?: (id: string) => void;
}

export interface TabsApi {
  element: HTMLElement;
  buttons: HTMLButtonElement[];
  select: (id: string, focus?: boolean) => void;
  activeId: () => string;
}

export const createTabs = (specs: readonly TabSpec[], options: TabsOptions): TabsApi => {
  const prefix = uid('ka11y-tabs');
  const tablist = h('div', { class: 'ka11y-tabs__list', role: 'tablist', 'aria-label': options.label });
  const wrapper = h('div', { class: 'ka11y-tabs' }, tablist);
  const buttons: HTMLButtonElement[] = [];
  const panels = new Map<string, HTMLElement>();
  let active = specs.some((spec) => spec.id === options.initial) ? (options.initial as string) : (specs[0]?.id ?? '');

  const sync = (): void => {
    specs.forEach((spec, index) => {
      const selected = spec.id === active;
      const tabButton = buttons[index];
      if (tabButton === undefined) return;
      tabButton.setAttribute('aria-selected', String(selected));
      tabButton.tabIndex = selected ? 0 : -1;
      const panel = panels.get(spec.id);
      if (panel !== undefined) panel.hidden = !selected;
    });
  };

  const select = (id: string, focus = false): void => {
    const index = specs.findIndex((spec) => spec.id === id);
    if (index === -1) return;
    active = id;
    sync();
    if (focus) buttons[index]?.focus();
    options.onSelect?.(id);
  };

  specs.forEach((spec) => {
    const tabId = `${prefix}-tab-${spec.id}`;
    const panelId = `${prefix}-panel-${spec.id}`;
    const tabButton = h('button', { type: 'button', class: 'ka11y-tabs__tab', role: 'tab', id: tabId, 'aria-controls': panelId }, spec.label);
    const onClick = (): void => select(spec.id);
    tabButton.addEventListener('click', onClick);
    buttons.push(tabButton);
    tablist.append(tabButton);

    spec.panel.setAttribute('role', 'tabpanel');
    spec.panel.id = panelId;
    spec.panel.setAttribute('aria-labelledby', tabId);
    spec.panel.tabIndex = 0;
    spec.panel.classList.add('ka11y-tabs__panel');
    panels.set(spec.id, spec.panel);
    wrapper.append(spec.panel);
  });

  const targetIndex = (key: string, current: number): number | null => {
    const rtl = getComputedStyle(wrapper).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (key === forward) return (current + 1) % specs.length;
    if (key === backward) return (current - 1 + specs.length) % specs.length;
    if (key === 'Home') return 0;
    if (key === 'End') return specs.length - 1;
    return null;
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const current = buttons.findIndex((tabButton) => tabButton === document.activeElement || tabButton === event.target);
    if (current === -1) return;
    const next = targetIndex(event.key, current);
    const spec = next === null ? undefined : specs[next];
    if (spec === undefined) return;
    event.preventDefault();
    select(spec.id, true);
  };
  tablist.addEventListener('keydown', onKeydown);

  sync();

  return { element: wrapper, buttons, select, activeId: () => active };
};
