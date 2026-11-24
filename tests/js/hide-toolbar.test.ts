import { createHideToolbar } from '../../src/ts/frontend/hide-toolbar';

const KEY = 'ka11y';

const create = (onChange?: (hidden: boolean) => void) => {
  const host = document.createElement('div');
  const toolbar = createHideToolbar({ host, key: KEY, onChange });
  return { host, toolbar };
};

describe('hide-toolbar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.useRealTimers();
  });

  it('starts visible', () => {
    const { host, toolbar } = create();
    expect(host.hidden).toBe(false);
    expect(toolbar.isHidden()).toBe(false);
  });

  it('hides for the session and persists in sessionStorage', () => {
    const onChange = jest.fn();
    const { host, toolbar } = create(onChange);
    toolbar.hideForSession();
    expect(host.hidden).toBe(true);
    expect(sessionStorage.getItem(`${KEY}-hidden`)).toBe('1');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(create().host.hidden).toBe(true);
  });

  it('hides for N days then expires', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
    create().toolbar.hideForDays(7);
    expect(create().host.hidden).toBe(true);
    jest.setSystemTime(new Date('2030-01-09T00:00:00Z'));
    expect(create().host.hidden).toBe(false);
    expect(localStorage.getItem(`${KEY}-hidden`)).toBeNull();
  });

  it('show clears both stores and reveals the host', () => {
    const { host, toolbar } = create();
    toolbar.hideForSession();
    toolbar.hideForDays(1);
    toolbar.show();
    expect(host.hidden).toBe(false);
    expect(sessionStorage.getItem(`${KEY}-hidden`)).toBeNull();
    expect(localStorage.getItem(`${KEY}-hidden`)).toBeNull();
    expect(create().host.hidden).toBe(false);
  });
});
