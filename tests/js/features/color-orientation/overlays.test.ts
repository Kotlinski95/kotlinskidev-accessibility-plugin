import { readingLine } from '../../../../src/ts/frontend/features/color-orientation/reading-line';
import { readingMask } from '../../../../src/ts/frontend/features/color-orientation/reading-mask';
import { resetDocument, runAnimationFramesSync } from './helpers';

const moveTo = (clientY: number): void => {
  document.dispatchEvent(new MouseEvent('pointermove', { clientY, bubbles: true }));
};

describe('reading overlays', () => {
  beforeEach(() => {
    resetDocument();
    runAnimationFramesSync();
  });

  it('reading line follows the pointer and is removed on off', () => {
    const before = document.body.innerHTML;
    readingLine.on(true);
    const line = document.querySelector<HTMLElement>('.ka11y-overlay--line');
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    moveTo(123);
    expect(line?.style.getPropertyValue('--ka11y-pointer-y')).toBe('123px');
    readingLine.off();
    expect(document.body.innerHTML).toBe(before);
    moveTo(10);
  });

  it('reading line does not duplicate on repeated on', () => {
    readingLine.on(true);
    readingLine.on(true);
    expect(document.querySelectorAll('.ka11y-overlay--line')).toHaveLength(1);
    readingLine.off();
  });

  it('reading mask creates no overlays until the first pointer move', () => {
    const before = document.body.innerHTML;
    readingMask.on(true);
    expect(document.querySelectorAll('.ka11y-overlay')).toHaveLength(0);
    moveTo(200);
    const masks = document.querySelectorAll<HTMLElement>('.ka11y-overlay--mask-top, .ka11y-overlay--mask-bottom');
    expect(masks).toHaveLength(2);
    masks.forEach((mask) => {
      expect(mask.getAttribute('aria-hidden')).toBe('true');
      expect(mask.style.getPropertyValue('--ka11y-pointer-y')).toBe('200px');
    });
    moveTo(300);
    masks.forEach((mask) => expect(mask.style.getPropertyValue('--ka11y-pointer-y')).toBe('300px'));
    readingMask.off();
    expect(document.body.innerHTML).toBe(before);
  });

  it('reading mask creates overlays on the first touch move', () => {
    readingMask.on(true);
    const event = new Event('touchmove', { bubbles: true });
    Object.defineProperty(event, 'touches', { value: [{ clientY: 55 }] });
    document.dispatchEvent(event);
    expect(document.querySelectorAll('.ka11y-overlay--mask-top')).toHaveLength(1);
    readingMask.off();
  });

  it('reading mask turned off before any move never creates overlays', () => {
    readingMask.on(true);
    readingMask.off();
    moveTo(100);
    expect(document.querySelectorAll('.ka11y-overlay')).toHaveLength(0);
  });

  it('reading mask does not duplicate on repeated on', () => {
    readingMask.on(true);
    readingMask.on(true);
    moveTo(100);
    readingMask.on(true);
    expect(document.querySelectorAll('.ka11y-overlay')).toHaveLength(2);
    readingMask.off();
  });

  it('overlay classes never collide with the html state classes', () => {
    document.documentElement.classList.add('ka11y-reading-mask', 'ka11y-reading-line');
    readingLine.on(true);
    readingMask.on(true);
    moveTo(100);
    document.querySelectorAll('.ka11y-overlay').forEach((overlay) => {
      expect(overlay.classList.contains('ka11y-reading-mask')).toBe(false);
      expect(overlay.classList.contains('ka11y-reading-line')).toBe(false);
    });
    readingLine.off();
    readingMask.off();
  });

  it('follows touch movement', () => {
    readingLine.on(true);
    const event = new Event('touchmove', { bubbles: true });
    Object.defineProperty(event, 'touches', { value: [{ clientY: 77 }] });
    document.dispatchEvent(event);
    expect(document.querySelector<HTMLElement>('.ka11y-overlay--line')?.style.getPropertyValue('--ka11y-pointer-y')).toBe('77px');
    readingLine.off();
  });
});
