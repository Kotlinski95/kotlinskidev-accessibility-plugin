import { muteSounds } from '../../../../src/ts/frontend/features/color-orientation/mute-sounds';
import { stopAnimations } from '../../../../src/ts/frontend/features/color-orientation/stop-animations';
import { flushObserver, resetDocument } from './helpers';

describe('muteSounds', () => {
  beforeEach(() => {
    resetDocument();
    document.body.innerHTML = '<audio id="a"></audio><video id="v" muted></video><div id="wrap"></div>';
  });

  afterEach(() => muteSounds.off());

  it('mutes existing media and restores original values', () => {
    const audio = document.getElementById('a') as HTMLMediaElement;
    const video = document.getElementById('v') as HTMLMediaElement;
    audio.muted = false;
    video.muted = true;
    muteSounds.on(true);
    expect(audio.muted).toBe(true);
    expect(video.muted).toBe(true);
    muteSounds.off();
    expect(audio.muted).toBe(false);
    expect(video.muted).toBe(true);
  });

  it('mutes media added later, including nested, and restores them', async () => {
    muteSounds.on(true);
    const added = document.createElement('audio');
    const wrapper = document.createElement('section');
    const nested = document.createElement('video');
    wrapper.append(nested);
    document.getElementById('wrap')?.append(added, wrapper);
    await flushObserver();
    expect(added.muted).toBe(true);
    expect(nested.muted).toBe(true);
    muteSounds.off();
    expect(added.muted).toBe(false);
    expect(nested.muted).toBe(false);
  });

  it('stops observing after off', async () => {
    muteSounds.on(true);
    muteSounds.off();
    const late = document.createElement('audio');
    document.body.append(late);
    await flushObserver();
    expect(late.muted).toBe(false);
  });
});

describe('stopAnimations', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const drawImage = jest.fn();

  beforeEach(() => {
    resetDocument();
    drawImage.mockClear();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage })) as unknown as typeof originalGetContext;
    document.body.innerHTML =
      '<video id="v1"></video><video id="v2"></video><img id="gif" alt="spin" class="pic" src="https://x.test/a.gif?v=1"><img id="png" src="a.png">';
    const gif = document.getElementById('gif') as HTMLImageElement;
    const png = document.getElementById('png') as HTMLImageElement;
    Object.defineProperty(gif, 'naturalWidth', { configurable: true, value: 40 });
    Object.defineProperty(gif, 'naturalHeight', { configurable: true, value: 30 });
    Object.defineProperty(png, 'naturalWidth', { configurable: true, value: 40 });
    Object.defineProperty(png, 'naturalHeight', { configurable: true, value: 30 });
  });

  afterEach(() => {
    stopAnimations.off();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('pauses playing videos and resumes only those it paused', () => {
    const v1 = document.getElementById('v1') as HTMLVideoElement;
    const v2 = document.getElementById('v2') as HTMLVideoElement;
    Object.defineProperty(v1, 'paused', { configurable: true, value: false });
    Object.defineProperty(v2, 'paused', { configurable: true, value: true });
    v1.pause = jest.fn();
    v2.pause = jest.fn();
    v1.play = jest.fn(() => Promise.resolve());
    v2.play = jest.fn(() => Promise.resolve());
    stopAnimations.on(true);
    expect(v1.pause).toHaveBeenCalled();
    expect(v2.pause).not.toHaveBeenCalled();
    stopAnimations.off();
    expect(v1.play).toHaveBeenCalled();
    expect(v2.play).not.toHaveBeenCalled();
  });

  it('freezes gifs into canvases and restores the DOM exactly', () => {
    const before = document.body.innerHTML;
    stopAnimations.on(true);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-ka11y-frozen]');
    expect(canvas?.getAttribute('aria-label')).toBe('spin');
    expect(canvas?.className).toBe('pic');
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(document.getElementById('gif')?.style.display).toBe('none');
    expect(document.getElementById('png')?.style.display).toBe('');
    expect(document.documentElement.classList.contains('ka11y-stop-animations')).toBe(true);
    stopAnimations.off();
    expect(document.body.innerHTML).toBe(before);
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });

  it('does not freeze twice on repeated on', () => {
    stopAnimations.on(true);
    stopAnimations.on(true);
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  });
});
