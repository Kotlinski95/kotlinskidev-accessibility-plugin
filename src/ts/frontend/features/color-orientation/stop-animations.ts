import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { freezeGifs } from './freeze-gifs';
import { addRootClass, removeRootClass } from './root-class';

const CLASS_NAME = featureClassBase('stopAnimations');

const pausedVideos = new Set<HTMLVideoElement>();
let unfreeze: (() => void) | null = null;

const pauseAutoplayVideos = (): void => {
  document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    if (video.paused || video.ended) return;
    pausedVideos.add(video);
    video.pause();
  });
};

const resumeVideos = (): void => {
  pausedVideos.forEach((video) => {
    const result = video.play() as Promise<void> | undefined;
    result?.catch(() => undefined);
  });
  pausedVideos.clear();
};

const on = (): void => {
  addRootClass(CLASS_NAME);
  pauseAutoplayVideos();
  unfreeze ??= freezeGifs();
};

const off = (): void => {
  removeRootClass(CLASS_NAME);
  resumeVideos();
  unfreeze?.();
  unfreeze = null;
};

export const stopAnimations: FeatureModule = { key: 'stopAnimations', on, off };
