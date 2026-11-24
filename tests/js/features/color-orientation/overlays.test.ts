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
    const line = document.querySelector<HTMLElement>('.ka11y-reading-line');
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
    expect(document.querySelectorAll('.ka11y-reading-line')).toHaveLength(1);
    readingLine.off();
  });

  it('reading mask creates two overlays that follow the pointer', () => {
    const before = document.body.innerHTML;
    readingMask.on(true);
    const masks = document.querySelectorAll<HTMLElement>('.ka11y-reading-mask');
    expect(masks).toHaveLength(2);
    moveTo(200);
    masks.forEach((mask) => {
      expect(mask.getAttribute('aria-hidden')).toBe('true');
      expect(mask.style.getPropertyValue('--ka11y-pointer-y')).toBe('200px');
    });
    readingMask.off();
    expect(document.body.innerHTML).toBe(before);
  });

  it('follows touch movement', () => {
    readingLine.on(true);
    const event = new Event('touchmove', { bubbles: true });
    Object.defineProperty(event, 'touches', { value: [{ clientY: 77 }] });
    document.dispatchEvent(event);
    expect(document.querySelector<HTMLElement>('.ka11y-reading-line')?.style.getPropertyValue('--ka11y-pointer-y')).toBe('77px');
    readingLine.off();
  });
});
