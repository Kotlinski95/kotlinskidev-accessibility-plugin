import { lineHeight } from '../../../../src/ts/frontend/features/content/line-height';
import { installFrames, resetDocument, setExcludeSelectors } from './helpers';
import type { Frames } from './helpers';
import { mountScalerFixture } from './scaler.shared';

const heightOf = (id: string): string => (document.getElementById(id) as HTMLElement).style.lineHeight;

describe('lineHeight', () => {
  let frames: Frames;

  beforeEach(() => {
    resetDocument();
    frames = installFrames();
    mountScalerFixture();
  });

  afterEach(() => {
    lineHeight.off();
    frames.restore();
  });

  it('cycles through 1.5, 1.75 and 2', () => {
    lineHeight.on(1);
    frames.flush();
    expect(heightOf('a')).toBe('1.5');
    lineHeight.on(2);
    frames.flush();
    expect(heightOf('a')).toBe('1.75');
    lineHeight.on(3);
    frames.flush();
    expect(heightOf('a')).toBe('2');
  });

  it('never lowers an already larger line height', () => {
    lineHeight.on(3);
    frames.flush();
    expect(heightOf('e')).toBe('3');
  });

  it('restores the exact markup on off', () => {
    const before = document.body.innerHTML;
    lineHeight.on(2);
    frames.flush();
    lineHeight.off();
    expect(document.body.innerHTML).toBe(before);
  });

  it('respects exclusions', () => {
    setExcludeSelectors('.skip');
    lineHeight.on(1);
    frames.flush();
    expect(heightOf('c')).toBe('1.2');
    expect(heightOf('d')).toBe('1.2');
    expect(heightOf('a')).toBe('1.5');
  });

  it('reaches block containers whose text lives only in inline children', () => {
    document.body.innerHTML =
      '<ul><li id="li" style="line-height:1.2"><a id="la" href="#" style="line-height:1.2">Link</a></li></ul><div id="wrap" style="line-height:1.2"><div id="empty" style="line-height:1.2"></div></div>';
    lineHeight.on(1);
    frames.flush();
    expect(heightOf('li')).toBe('1.5');
    expect(heightOf('la')).toBe('1.5');
    expect(heightOf('empty')).toBe('1.2');
  });
});
