import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBareStateSelectors, readFeatureKeys } from './lib-scss-scope.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const cssPath = process.argv[2] ?? resolve(root, 'build/frontend.css');
const schemaPath = process.argv[3] ?? resolve(root, 'src/php/Settings/Schema.php');

const offenders = findBareStateSelectors(readFileSync(cssPath, 'utf8'), readFeatureKeys(schemaPath));

if (offenders.length > 0) {
  console.error(`Page CSS selectors match a bare <html> state class:\n${offenders.map((selector) => `  ${selector}`).join('\n')}`);
  process.exit(1);
}

console.log('Page CSS state classes are scoped to html');
