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
  panel.innerHTML = '<button id="first">first</button>';
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

  it('syncs aria-expanded on the launcher', () => {
    const { dialog, launcher } = setup();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    dialog.open();
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    dialog.close();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });
});
