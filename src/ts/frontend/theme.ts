import type { ThemeConfig } from '../shared/types';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeOptions {
  host: HTMLElement;
  config: ThemeConfig;
  doc?: Document;
  win?: Window;
}

export interface ThemeResolver {
  resolve(): ResolvedTheme;
  destroy(): void;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

const matchesSelector = (element: Element | null, selector: string): boolean => {
  if (!element || selector.trim() === '') return false;
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
};

export const createThemeResolver = ({ host, config, doc = document, win = window }: ThemeOptions): ThemeResolver => {
  const query = typeof win.matchMedia === 'function' ? win.matchMedia(DARK_QUERY) : null;

  const roots = (): Element[] => [doc.documentElement, doc.body].filter((item): item is HTMLElement => item !== null);

  const matchesAny = (selector: string): boolean => roots().some((element) => matchesSelector(element, selector));

  const resolve = (): ResolvedTheme => {
    if (config.mode === 'light' || config.mode === 'dark') return config.mode;
    if (matchesAny(config.darkSelector)) return 'dark';
    if (matchesAny(config.lightSelector)) return 'light';
    if (config.followPrefersColorScheme && query?.matches) return 'dark';
    return 'light';
  };

  const update = (): void => {
    host.dataset.theme = resolve();
  };

  const onMediaChange = (): void => update();
  const onMutation = (): void => update();

  const observer = new MutationObserver(onMutation);
  roots().forEach((element) => observer.observe(element, { attributes: true, attributeFilter: ['class'] }));
  if (config.mode === 'auto' && config.followPrefersColorScheme) query?.addEventListener('change', onMediaChange);
  update();

  const destroy = (): void => {
    observer.disconnect();
    query?.removeEventListener('change', onMediaChange);
  };

  return { resolve, destroy };
};
