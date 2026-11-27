import { readFileSync, writeFileSync } from 'node:fs';
import { signPackage } from './lib-sign.mjs';

const zipPath = process.argv[2];

try {
  if (!zipPath) {
    throw new Error('Usage: node bin/sign-release.mjs <zip>');
  }
  const signature = signPackage(readFileSync(zipPath), process.env.RELEASE_SIGNING_KEY ?? '');
  writeFileSync(`${zipPath}.sig`, `${signature}\n`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
