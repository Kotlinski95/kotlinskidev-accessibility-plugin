import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';
import { releaseTemporaryFocusTargets } from './focus-target';
import { addRootClass, removeRootClass } from './root-class';

const CLASS_NAME = featureClassBase('skipToContent');

const on = (): void => addRootClass(CLASS_NAME);

const off = (): void => {
  removeRootClass(CLASS_NAME);
  releaseTemporaryFocusTargets();
};

export const skipToContent: FeatureModule = { key: 'skipToContent', on, off };
