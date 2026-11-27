import { MOTION_EVENT, setMotionStopped } from '../../../../src/ts/frontend/features/color-orientation/motion-state';
import { stopAnimations } from '../../../../src/ts/frontend/features/color-orientation/stop-animations';
import { mockMatchMedia } from './helpers';

describe('motion state', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    setMotionStopped(false);
    delete (window as unknown as Record<string, unknown>).gsap;
  });

  it('publishes state and dispatches an event on both transitions', () => {
    const seen: boolean[] = [];
    const listener = (event: Event): void => {
      seen.push((event as CustomEvent<{ stopped: boolean }>).detail.stopped);
    };
    window.addEventListener(MOTION_EVENT, listener);
    setMotionStopped(true);
    expect(window.kotlinskidevA11yMotion).toEqual({ stopped: true });
    setMotionStopped(false);
    expect(window.kotlinskidevA11yMotion).toEqual({ stopped: false });
    window.removeEventListener(MOTION_EVENT, listener);
    expect(seen).toEqual([true, false]);
  });

  it('makes reduced-motion queries report reduce while stopped and restores them', () => {
    setMotionStopped(true);
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    expect(window.matchMedia('(prefers-reduced-motion)').matches).toBe(true);
    expect(window.matchMedia('(prefers-reduced-motion: no-preference)').matches).toBe(false);
    expect(window.matchMedia('(min-width: 10px)').matches).toBe(false);
    setMotionStopped(false);
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
  });

  it('keeps list methods working through the emulated query', () => {
    setMotionStopped(true);
    const list = window.matchMedia('(prefers-reduced-motion: reduce)');
    expect(() => list.addEventListener('change', () => undefined)).not.toThrow();
  });

  it('does not stack the patch when stopped twice', () => {
    setMotionStopped(true);
    setMotionStopped(true);
    setMotionStopped(false);
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
  });

  it('pauses and resumes the GSAP global timeline when present', () => {
    const timeline = { pause: jest.fn(), resume: jest.fn() };
    (window as unknown as { gsap: unknown }).gsap = { globalTimeline: timeline };
    setMotionStopped(true);
    expect(timeline.pause).toHaveBeenCalledTimes(1);
    setMotionStopped(false);
    expect(timeline.resume).toHaveBeenCalledTimes(1);
  });

  it('is driven by the stopAnimations feature', () => {
    stopAnimations.on(true);
    expect(window.kotlinskidevA11yMotion?.stopped).toBe(true);
    stopAnimations.off();
    expect(window.kotlinskidevA11yMotion?.stopped).toBe(false);
  });
});
