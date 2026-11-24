import type { FeatureModule } from '../../apply';

const MEDIA_SELECTOR = 'audio, video';

const originalMuted = new Map<HTMLMediaElement, boolean>();
let observer: MutationObserver | null = null;

const mute = (media: HTMLMediaElement): void => {
  if (!originalMuted.has(media)) originalMuted.set(media, media.muted);
  media.muted = true;
};

const muteWithin = (node: Node): void => {
  if (!(node instanceof Element)) return;
  if (node.matches(MEDIA_SELECTOR)) mute(node as HTMLMediaElement);
  node.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach(mute);
};

const onMediaMutation = (records: MutationRecord[]): void => {
  records.forEach((record) => record.addedNodes.forEach(muteWithin));
};

const on = (): void => {
  document.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach(mute);
  if (observer) return;
  observer = new MutationObserver(onMediaMutation);
  observer.observe(document.documentElement, { childList: true, subtree: true });
};

const off = (): void => {
  observer?.disconnect();
  observer = null;
  originalMuted.forEach((muted, media) => {
    media.muted = muted;
  });
  originalMuted.clear();
};

export const muteSounds: FeatureModule = { key: 'muteSounds', on, off };
