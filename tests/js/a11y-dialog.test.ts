import { createDialog, type Dialog } from '../../src/ts/frontend/a11y-dialog';

interface Setup {
  host: HTMLElement;
  launcher: HTMLButtonElement;
  dialog: Dialog;
  outside: HTMLButtonElement;
}

const setup = (): Setup => {
  document.body.innerHTML = '<button id="outside">outside</button><div id="ka11y-root"></div>';
  const host = document.getElementById('ka11y-root') as HTMLElement;
  const shadow = host.attachShadow({ mode: 'open' });
  const launcher = document.createElement('button');
  const panel = document.createElement('div');
  panel.id = 'ka11y-panel';
  panel.setAttribute('aria-labelledby', 'title');
  panel.innerHTML = '<h2 id="title">Title</h2><button id="first">first</button><button id="last">last</button>';
  shadow.append(launcher, panel);
  const dialog = createDialog({ panel, launcher, shadow });
  return { host, launcher, dialog, outside: document.getElementById('outside') as HTMLButtonElement };
};

describe('a11y-dialog focus return', () => {
  it('returns focus to the opener', () => {
    const { dialog, outside } = setup();
    const opener = document.createElement('button');
    document.body.append(opener);
    outside.focus();
    dialog.open(opener);
    dialog.close();
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to the element active before opening', () => {
    const { dialog, outside } = setup();
    outside.focus();
    dialog.open();
    dialog.close();
    expect(document.activeElement).toBe(outside);
  });

  it('returns focus to a visible launcher when nothing was focused', () => {
    const { dialog, launcher, host } = setup();
    dialog.open();
    dialog.close();
    expect(host.shadowRoot?.activeElement).toBe(launcher);
  });

  it('falls back to the launcher when the opener is gone', () => {
    const { dialog, launcher, host } = setup();
    const opener = document.createElement('button');
    document.body.append(opener);
    dialog.open(opener);
    opener.remove();
    dialog.close();
    expect(host.shadowRoot?.activeElement).toBe(launcher);
  });

  it('falls back to body when the opener is hidden and the launcher is hidden', () => {
    const { dialog, launcher, host } = setup();
    host.setAttribute('data-ka11y-launcher', 'hidden');
    launcher.hidden = true;
    const wrapper = document.createElement('div');
    const opener = document.createElement('button');
    wrapper.append(opener);
    document.body.append(wrapper);
    dialog.open(opener);
    wrapper.hidden = true;
    dialog.close();
    expect(document.activeElement).toBe(document.body);
    expect(document.body.hasAttribute('tabindex')).toBe(false);
  });

  it('falls back to body when launcher mode is hidden and nothing was focused', () => {
    const { dialog, host } = setup();
    host.setAttribute('data-ka11y-launcher', 'hidden');
    dialog.open();
    dialog.close();
    expect(document.activeElement).toBe(document.body);
  });

  it('returns to the last focused page element in hidden launcher mode without an opener', () => {
    const { dialog, host, outside } = setup();
    host.setAttribute('data-ka11y-launcher', 'hidden');
    outside.focus();
    outside.blur();
    expect(document.activeElement).toBe(document.body);
    dialog.open();
    dialog.close();
    expect(document.activeElement).toBe(outside);
  });

  it('returns to the previously focused element when the opener is gone', () => {
    const { dialog, host, outside } = setup();
    host.setAttribute('data-ka11y-launcher', 'hidden');
    const opener = document.createElement('button');
    document.body.append(opener);
    outside.focus();
    dialog.open(opener);
    opener.remove();
    dialog.close();
    expect(document.activeElement).toBe(outside);
  });

  it('stops tracking focus after destroy', () => {
    const { dialog, host, outside } = setup();
    host.setAttribute('data-ka11y-launcher', 'hidden');
    dialog.destroy();
    outside.focus();
    outside.blur();
    dialog.open();
    dialog.close();
    expect(document.activeElement).toBe(document.body);
  });

  it('syncs aria-expanded on the launcher', () => {
    const { dialog, launcher } = setup();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    dialog.open();
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    dialog.close();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not set aria-modal', () => {
    const { dialog } = setup();
    dialog.open();
    expect(document.querySelector('[aria-modal]')).toBeNull();
    expect((document.getElementById('ka11y-root')?.shadowRoot?.getElementById('ka11y-panel'))?.hasAttribute('aria-modal')).toBe(false);
  });

  it('moves initial focus to the title', () => {
    const { dialog, host } = setup();
    dialog.open();
    expect(host.shadowRoot?.activeElement?.id).toBe('title');
  });

  it('does not trap Tab', () => {
    const { dialog, host } = setup();
    dialog.open();
    (host.shadowRoot?.getElementById('last') as HTMLElement).focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(host.shadowRoot?.activeElement?.id).toBe('last');
  });

  it('does not close on an outside click', () => {
    const { dialog, outside } = setup();
    dialog.open();
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    outside.click();
    expect(dialog.isOpen()).toBe(true);
  });

  it('closes on Escape from inside the panel', () => {
    const { dialog } = setup();
    dialog.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isOpen()).toBe(false);
  });

  it('closes on Escape when the launcher has focus', () => {
    const { dialog, launcher } = setup();
    dialog.open();
    launcher.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isOpen()).toBe(false);
  });

  it('ignores Escape when focus is on the page', () => {
    const { dialog, outside } = setup();
    dialog.open();
    outside.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isOpen()).toBe(true);
  });
});
