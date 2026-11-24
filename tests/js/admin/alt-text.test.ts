import { mountAltText } from '../../../src/ts/admin/alt-text';
import type { Fetcher } from '../../../src/ts/admin/api';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });
jest.mock('@wordpress/api-fetch', () => jest.requireActual('./wp-mocks').apiFetchMock, { virtual: true });

const CONFIG = { restRoot: 'https://example.test/wp-json/kotlinskidev-a11y/v1/', nonce: 'abc' };

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const setup = (fetcher: jest.Mock): { root: HTMLElement; input: HTMLInputElement; save: HTMLButtonElement; status: HTMLElement; remaining: HTMLElement } => {
  document.body.innerHTML = `
    <div id="root">
      <p><span data-ka11y-remaining>5</span> missing</p>
      <ul>
        <li class="ka11y-alt-row" data-attachment-id="42" data-file="cat.jpg">
          <label for="f">Alt text</label>
          <input id="f" class="ka11y-alt-row__input" type="text">
          <button type="button" class="ka11y-alt-row__save">Save</button>
        </li>
      </ul>
    </div>`;
  const root = document.getElementById('root') as HTMLElement;
  mountAltText(root, CONFIG, fetcher as unknown as Fetcher);
  return {
    root,
    input: root.querySelector('input') as HTMLInputElement,
    save: root.querySelector('button') as HTMLButtonElement,
    status: root.querySelector('[role="status"]') as HTMLElement,
    remaining: root.querySelector('[data-ka11y-remaining]') as HTMLElement,
  };
};

describe('alt text editor', () => {
  it('creates a polite live region', () => {
    const { status } = setup(jest.fn());
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('saves on click, announces, and updates remaining', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 42, alt: 'A cat', remaining: 4 });
    const { input, save, status, remaining } = setup(fetcher);
    input.value = '  A cat ';
    save.click();
    await flush();
    expect(fetcher).toHaveBeenCalledWith({
      url: `${CONFIG.restRoot}alt-text/42`,
      method: 'POST',
      headers: { 'X-WP-Nonce': 'abc' },
      data: { alt: 'A cat' },
    });
    expect(status.textContent).toBe('Alt text saved for cat.jpg.');
    expect(status.classList.contains('is-error')).toBe(false);
    expect(remaining.textContent).toBe('4');
    expect(input.disabled).toBe(false);
  });

  it('announces failure and re-enables the field', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('Forbidden'));
    const { input, save, status, remaining } = setup(fetcher);
    input.value = 'A cat';
    save.click();
    await flush();
    expect(status.textContent).toBe('Forbidden');
    expect(status.classList.contains('is-error')).toBe(true);
    expect(remaining.textContent).toBe('5');
    expect(input.disabled).toBe(false);
    expect(save.disabled).toBe(false);
  });

  it('saves when Enter is pressed in the field', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 42, alt: 'A cat', remaining: 4 });
    const { input } = setup(fetcher);
    input.value = 'A cat';
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const fetcher = jest.fn();
    const { input } = setup(fetcher);
    input.value = 'A cat';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('disables field and button while saving', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const fetcher = jest.fn().mockReturnValue(new Promise((done) => (resolve = done)));
    const { root, input, save } = setup(fetcher);
    input.value = 'A cat';
    save.click();
    expect(input.disabled).toBe(true);
    expect(save.disabled).toBe(true);
    expect(root.querySelector('.ka11y-alt-row')?.getAttribute('aria-busy')).toBe('true');
    resolve({ id: 42, alt: 'A cat', remaining: 4 });
    await flush();
    expect(input.disabled).toBe(false);
    expect(root.querySelector('.ka11y-alt-row')?.getAttribute('aria-busy')).toBe('false');
  });

  it('does not send an empty value', async () => {
    const fetcher = jest.fn();
    const { input, save, status } = setup(fetcher);
    input.value = '   ';
    save.click();
    await flush();
    expect(fetcher).not.toHaveBeenCalled();
    expect(status.textContent).toBe('Enter alt text for cat.jpg before saving.');
    expect(status.classList.contains('is-error')).toBe(true);
  });
});
