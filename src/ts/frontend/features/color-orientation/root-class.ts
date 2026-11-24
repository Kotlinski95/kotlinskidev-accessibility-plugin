import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';

export const addRootClass = (className: string, root: HTMLElement = document.documentElement): void => {
  root.classList.add(className);
};

export const removeRootClass = (className: string, root: HTMLElement = document.documentElement): void => {
  root.classList.remove(className);
  if (root.classList.length === 0) root.removeAttribute('class');
};

export const createClassFeature = (key: string): FeatureModule => {
  const className = featureClassBase(key);
  const on = (): void => addRootClass(className);
  const off = (): void => removeRootClass(className);
  return { key, on, off };
};
