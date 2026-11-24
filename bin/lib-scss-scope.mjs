import { readFileSync } from 'node:fs';

const kebabCase = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const readFeatureKeys = (schemaPath) => {
  const source = readFileSync(schemaPath, 'utf8');
  const block = /FEATURE_KEYS\s*=\s*array\(([^)]*)\)/.exec(source);
  if (!block) throw new Error(`FEATURE_KEYS not found in ${schemaPath}`);
  return [...block[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((match) => match[1]);
};

const selectorsOf = (css) =>
  [...css.matchAll(/([^{};]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((prelude) => !prelude.startsWith('@'))
    .flatMap((prelude) => prelude.split(/,(?![^(]*\))/).map((selector) => selector.trim()));

const compoundsOf = (selector) => selector.split(/\s*[>+~]\s*|\s+/).filter((part) => part !== '');

const isScopedToRoot = (compound) => /^(html|:root)(?![\w-])/.test(compound);

export const findBareStateSelectors = (css, featureKeys) => {
  const stateClasses = featureKeys.map((key) => `.ka11y-${kebabCase(key)}`);
  const offenders = new Set();

  selectorsOf(css).forEach((selector) => {
    compoundsOf(selector).forEach((compound) => {
      const hasState = stateClasses.some((stateClass) => {
        const index = compound.indexOf(stateClass);
        if (index === -1) return false;
        return !/[\w-]/.test(compound.charAt(index + stateClass.length));
      });
      if (hasState && !isScopedToRoot(compound)) offenders.add(selector);
    });
  });

  return [...offenders];
};
