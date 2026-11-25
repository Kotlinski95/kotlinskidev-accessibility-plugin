import { buildTriggersPanel, copyText } from '../../../src/ts/admin/panels/triggers';
import { change, sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const mounted = (ctx = sampleContext()): { panel: HTMLElement; ctx: ReturnType<typeof sampleContext> } => {
  const panel = buildTriggersPanel(ctx);
  document.body.append(panel);
  return { panel, ctx };
};

const field = (panel: HTMLElement, kind: string): HTMLTextAreaElement =>
  [...panel.querySelectorAll('.ka11y-snippets__row')].find((row) => row.querySelector('label')?.textContent === kind)?.querySelector('textarea') as HTMLTextAreaElement;

afterEach(() => {
  document.body.replaceChildren();
});

describe('triggers panel', () => {
  it('renders the four sections', () => {
    const { panel } = mounted();
    const legends = [...panel.querySelectorAll('legend')].map((item) => item.textContent);
    expect(legends).toEqual(expect.arrayContaining(['Launcher', 'Custom selectors', 'URL actions', 'Snippet generator']));
  });

  it('shows the mount field only for the inline launcher', () => {
    const { panel, ctx } = mounted();
    const mount = panel.querySelector('.ka11y-launcher-mount') as HTMLElement;
    expect(mount.hidden).toBe(true);
    ctx.state.set('widget.launcher', 'inline');
    expect(mount.hidden).toBe(false);
  });

  it('states the selector limits in the help text', () => {
    const { panel } = mounted();
    expect(panel.textContent).toContain('Up to 10 selectors, 300 characters in total.');
  });

  it('shows an inline error per invalid selector', () => {
    const { panel, ctx } = mounted();
    ctx.state.set('triggers.selectors', ['.ok', '(((', 'body']);
    const items = [...panel.querySelectorAll('.ka11y-selector-errors__item')].map((item) => item.textContent);
    expect(items).toEqual(['((( is not a valid selector.', 'body is too broad and will not be saved.']);
  });

  it('saves URL actions through the checklist', () => {
    const { panel, ctx } = mounted();
    const boxes = panel.querySelectorAll<HTMLInputElement>('.ka11y-url-actions input[type="checkbox"]');
    expect(boxes).toHaveLength(3);
    const feature = boxes[1] as HTMLInputElement;
    feature.checked = false;
    change(feature, 'change');
    expect(ctx.state.get('triggers.urlActions')).toEqual(['open', 'profile']);
  });

  it('does not change settings when the generator is used', () => {
    const { panel, ctx } = mounted();
    const before = JSON.stringify(ctx.state.snapshot());
    const label = panel.querySelector('.ka11y-snippets input[type="text"]') as HTMLInputElement;
    label.value = 'Hi';
    change(label, 'input');
    expect(JSON.stringify(ctx.state.snapshot())).toBe(before);
  });

  it('fills outputs and hides the URL output for non-URL actions', () => {
    const { panel } = mounted();
    const select = panel.querySelector('.ka11y-snippets select') as HTMLSelectElement;
    expect(field(panel, 'HTML').value).toContain('data-ka11y="open"');
    expect(field(panel, 'URL').closest('.ka11y-snippets__row')).toHaveProperty('hidden', false);
    select.value = 'close';
    change(select, 'change');
    expect(field(panel, 'URL').closest('.ka11y-snippets__row')).toHaveProperty('hidden', true);
    expect(field(panel, 'JavaScript').value).toBe('kotlinskidevA11y.close();');
  });

  it('builds the preview without markup injection and ignores clicks', () => {
    const { panel } = mounted();
    const label = panel.querySelector('.ka11y-snippets input[type="text"]') as HTMLInputElement;
    label.value = '<img src=x onerror=alert(1)>';
    change(label, 'input');
    const preview = panel.querySelector('.ka11y-snippets__preview') as HTMLElement;
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.textContent).toBe('<img src=x onerror=alert(1)>');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    preview.firstElementChild?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('copies an output and announces it', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { panel } = mounted();
    const copy = panel.querySelector('.ka11y-snippets__copy') as HTMLButtonElement;
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(field(panel, 'HTML').value);
    expect(panel.querySelector('.ka11y-snippets__status')?.textContent).toBe('HTML copied.');
  });

  it('falls back to execCommand when the clipboard rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    const exec = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    const area = document.createElement('textarea');
    document.body.append(area);
    expect(await copyText(area)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });
});

describe('triggers panel home check', () => {
  const withFetch = (body: string): jest.Mock => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(`<html><body>${body}</body></html>`) });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    return fetchMock;
  };

  const hiddenContext = (): ReturnType<typeof sampleContext> => {
    const ctx = sampleContext();
    ctx.state.set('widget.launcher', 'hidden');
    return ctx;
  };

  it('shows the warning when no trigger exists and the shortcut is on', async () => {
    withFetch('<p>none</p>');
    const { panel } = mounted(hiddenContext());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(panel.querySelector('.ka11y-trigger-check')?.textContent).toContain('Visitors can open the panel only with the keyboard shortcut.');
  });

  it('shows the error when the shortcut is also off', async () => {
    withFetch('<p>none</p>');
    const ctx = hiddenContext();
    ctx.state.set('shortcut.enabled', false);
    const { panel } = mounted(ctx);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(panel.querySelector('.notice-error')?.textContent).toContain('Visitors cannot open the panel.');
  });

  it('shows nothing when a trigger exists', async () => {
    withFetch('<button class="ka11y-open">x</button>');
    const { panel } = mounted(hiddenContext());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(panel.querySelector('.ka11y-trigger-check')?.children).toHaveLength(0);
  });

  it('reports a failed check', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });
    const { panel } = mounted(hiddenContext());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(panel.querySelector('.ka11y-trigger-check')?.textContent).toBe('The home page could not be checked.');
  });
});
