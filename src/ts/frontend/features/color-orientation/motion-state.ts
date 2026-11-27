export const MOTION_EVENT = 'kotlinskidev-a11y:motion';

const REDUCE_QUERY = /^\s*\(\s*prefers-reduced-motion\s*(:\s*reduce\s*)?\)\s*$/i;
const NO_PREFERENCE_QUERY = /^\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*$/i;

interface PausableTimeline {
  pause(): unknown;
  resume(): unknown;
}

type MatchMedia = typeof window.matchMedia;

let originalMatchMedia: MatchMedia | null = null;

const emulatedMatches = (query: string): boolean | null => {
  if (REDUCE_QUERY.test(query)) return true;
  if (NO_PREFERENCE_QUERY.test(query)) return false;
  return null;
};

const emulate = (list: MediaQueryList, matches: boolean): MediaQueryList =>
  new Proxy(list, {
    get: (target, property) => {
      if (property === 'matches') return matches;
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });

const patchMatchMedia = (): void => {
  if (originalMatchMedia !== null || typeof window.matchMedia !== 'function') return;
  const original = window.matchMedia.bind(window);
  originalMatchMedia = window.matchMedia;
  window.matchMedia = (query: string): MediaQueryList => {
    const list = original(query);
    const matches = emulatedMatches(query);
    return matches === null ? list : emulate(list, matches);
  };
};

const restoreMatchMedia = (): void => {
  if (originalMatchMedia === null) return;
  window.matchMedia = originalMatchMedia;
  originalMatchMedia = null;
};

const gsapTimeline = (): PausableTimeline | null => {
  const holder = window as unknown as { gsap?: { globalTimeline?: PausableTimeline } };
  return holder.gsap?.globalTimeline ?? null;
};

export const setMotionStopped = (stopped: boolean): void => {
  window.kotlinskidevA11yMotion = { stopped };
  if (stopped) patchMatchMedia();
  else restoreMatchMedia();
  const timeline = gsapTimeline();
  if (stopped) timeline?.pause();
  else timeline?.resume();
  window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: { stopped } }));
};
