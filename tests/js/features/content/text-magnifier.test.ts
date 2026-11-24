import { textMagnifier } from '../../../../src/ts/frontend/features/content/text-magnifier';
import { installFrames, resetDocument, setExcludeSelectors } from './helpers';
import type { Frames } from './helpers';

const move = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 50 }));
};

const tooltip = (root: ParentNode = document): HTMLElement | null => root.querySelector<HTMLElement>('[data-ka11y-magnifier]');

describe('textMagnifier', () => {
  let frames: Frames;

  beforeEach(() => {
    resetDocument();
    frames = installFrames();
    document.body.innerHTML = '<p id="a">Hello   magnified world</p><div class="skip"><p id="b">excluded</p></div><div id="empty"></div>';
  });

  afterEach(() => {
    textMagnifier.off();
    frames.restore();
  });

  it('shows hovered text in an aria-hidden tooltip near the pointer', () => {
    textMagnifier.on(true);
    expect(tooltip()?.getAttribute('aria-hidden')).toBe('true');
    expect(tooltip()?.hidden).toBe(true);
    move(document.getElementById('a') as Element);
    frames.flush();
    expect(tooltip()?.hidden).toBe(false);
    expect(tooltip()?.textContent).toBe('Hello magnified world');
    expect(tooltip()?.style.left).toBe('58px');
    expect(tooltip()?.style.top).toBe('68px');
  });

  it('throttles to one update per frame', () => {
    textMagnifier.on(true);
    move(document.getElementById('a') as Element);
    move(document.getElementById('empty') as Element);
    frames.flush();
    expect(tooltip()?.hidden).toBe(true);
  });

  it('hides for excluded and empty targets', () => {
    setExcludeSelectors('.skip');
    textMagnifier.on(true);
    move(document.getElementById('b') as Element);
    frames.flush();
    expect(tooltip()?.hidden).toBe(true);
    move(document.getElementById('empty') as Element);
    frames.flush();
    expect(tooltip()?.hidden).toBe(true);
  });

  it('hides when the pointer leaves the document', () => {
    textMagnifier.on(true);
    move(document.getElementById('a') as Element);
    frames.flush();
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    expect(tooltip()?.hidden).toBe(true);
  });

  it('follows keyboard focus', () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="f">Focus me</button>');
    textMagnifier.on(true);
    (document.getElementById('f') as HTMLElement).focus();
    frames.flush();
    expect(tooltip()?.textContent).toBe('Focus me');
  });

  it('mounts inside the widget shadow root when present', () => {
    const host = document.createElement('div');
    host.id = 'ka11y-root';
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    textMagnifier.on(true);
    expect(tooltip(shadow)).not.toBeNull();
    expect(tooltip(document.body)).toBeNull();
  });

  it('removes the tooltip and listeners on off and restores the markup', () => {
    const before = document.body.innerHTML;
    textMagnifier.on(true);
    textMagnifier.off();
    expect(document.body.innerHTML).toBe(before);
    move(document.getElementById('a') as Element);
    frames.flush();
    expect(tooltip()).toBeNull();
  });
});
