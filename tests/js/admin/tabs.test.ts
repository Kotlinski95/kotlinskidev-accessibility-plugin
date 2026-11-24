import { createTabs } from '../../../src/ts/admin/tabs';
import { press } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const build = (onSelect?: (id: string) => void) => {
  const specs = ['one', 'two', 'three'].map((id) => ({ id, label: id, panel: document.createElement('div') }));
  const tabs = createTabs(specs, { label: 'Sections', onSelect });
  document.body.replaceChildren(tabs.element);
  return tabs;
};

describe('tabs', () => {
  it('applies the ARIA tablist pattern', () => {
    const tabs = build();
    const list = tabs.element.querySelector('[role="tablist"]');
    expect(list?.getAttribute('aria-label')).toBe('Sections');
    const [first, second] = tabs.buttons;
    expect(first?.getAttribute('aria-selected')).toBe('true');
    expect(first?.tabIndex).toBe(0);
    expect(second?.tabIndex).toBe(-1);
    const panel = document.getElementById(first?.getAttribute('aria-controls') ?? '');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe(first?.id);
    expect(panel?.hidden).toBe(false);
    const other = document.getElementById(second?.getAttribute('aria-controls') ?? '');
    expect(other?.hidden).toBe(true);
  });

  it('moves with arrow keys and wraps', () => {
    const onSelect = jest.fn();
    const tabs = build(onSelect);
    const [first, second, third] = tabs.buttons;
    first?.focus();
    press(first as HTMLElement, 'ArrowRight');
    expect(document.activeElement).toBe(second);
    expect(tabs.activeId()).toBe('two');
    press(second as HTMLElement, 'End');
    expect(document.activeElement).toBe(third);
    press(third as HTMLElement, 'ArrowRight');
    expect(document.activeElement).toBe(first);
    press(first as HTMLElement, 'ArrowLeft');
    expect(document.activeElement).toBe(third);
    press(third as HTMLElement, 'Home');
    expect(document.activeElement).toBe(first);
    expect(onSelect).toHaveBeenLastCalledWith('one');
  });

  it('selects on click and ignores other keys', () => {
    const tabs = build();
    tabs.buttons[2]?.click();
    expect(tabs.activeId()).toBe('three');
    expect(tabs.buttons[2]?.getAttribute('aria-selected')).toBe('true');
    const event = press(tabs.buttons[2] as HTMLElement, 'a');
    expect(event.defaultPrevented).toBe(false);
  });

  it('honors the initial tab', () => {
    const specs = ['one', 'two'].map((id) => ({ id, label: id, panel: document.createElement('div') }));
    const tabs = createTabs(specs, { label: 'x', initial: 'two' });
    expect(tabs.activeId()).toBe('two');
  });
});
