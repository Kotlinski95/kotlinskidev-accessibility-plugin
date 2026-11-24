import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

export const wpCli = (...args: string[]): string =>
  execFileSync('npx', ['wp-env', 'run', 'cli', 'wp', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

export const tryWpCli = (...args: string[]): boolean => {
  try {
    wpCli(...args);
    return true;
  } catch {
    return false;
  }
};
