import type { FeatureModule } from '../../apply';
import { featureClassBase } from '../../feature-utils';

export const DYSLEXIC_FONT_FAMILY = 'KA11y OpenDyslexic';
export const DYSLEXIC_STYLE_ID = 'ka11y-dyslexic-face';

const buildFontFace = (url: string): string =>
  `@font-face{font-family:"${DYSLEXIC_FONT_FAMILY}";src:url("${url.replace(/["\\\n\r]/g, '')}") format("woff2");font-weight:400;font-style:normal;font-display:swap}`;

const ensureFontFace = (): void => {
  if (document.getElementById(DYSLEXIC_STYLE_ID)) return;
  const url = window.kotlinskidevA11y?.assets?.dyslexicFontUrl ?? '';
  if (url === '') return;
  const style = document.createElement('style');
  style.id = DYSLEXIC_STYLE_ID;
  style.textContent = buildFontFace(url);
  document.head.append(style);
};

const removeFontFace = (): void => {
  document.getElementById(DYSLEXIC_STYLE_ID)?.remove();
};

const className = featureClassBase('dyslexicFont');

const on = (): void => {
  ensureFontFace();
  document.documentElement.classList.add(className);
};

const off = (): void => {
  document.documentElement.classList.remove(className);
  if (document.documentElement.classList.length === 0) document.documentElement.removeAttribute('class');
  removeFontFace();
};

export const dyslexicFont: FeatureModule = { key: 'dyslexicFont', on, off };
