import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';

const clearEmptyClassAttribute = (root: HTMLElement): void => {
  if (root.classList.length === 0) root.removeAttribute('class');
};

export const createClassFeature = (key: string): FeatureModule => {
  const className = featureClassBase(key);

  const on = (): void => {
    document.documentElement.classList.add(className);
  };

  const off = (): void => {
    document.documentElement.classList.remove(className);
    clearEmptyClassAttribute(document.documentElement);
  };

  return { key, on, off };
};
