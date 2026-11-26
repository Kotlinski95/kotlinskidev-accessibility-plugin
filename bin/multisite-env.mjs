import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const config = '.wp-env.multisite.json';
const env = { ...process.env, WP_ENV_HOME: process.env.WP_ENV_HOME ?? join(homedir(), '.wp-env-ka11y-multisite') };
const subsite = 'sub';

const htaccess = [
  'RewriteEngine On',
  'RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]',
  'RewriteBase /',
  'RewriteRule ^index\\.php$ - [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?wp-admin$ $1wp-admin/ [R=301,L]',
  'RewriteCond %{REQUEST_FILENAME} -f [OR]',
  'RewriteCond %{REQUEST_FILENAME} -d',
  'RewriteRule ^ - [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]',
  'RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\\.php)$ $2 [L]',
  'RewriteRule . index.php [L]',
  '',
].join('\n');

const run = (args, { allowFailure = false } = {}) => {
  const result = spawnSync('npx', ['wp-env', ...args], { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
};

const wp = (args, options) => run(['run', 'cli', `--config=${config}`, 'wp', ...args], options);

const start = () => {
  run(['start', `--config=${config}`]);
  if (wp(['core', 'is-installed', '--network'], { allowFailure: true }).status !== 0) {
    wp(['core', 'multisite-convert', '--title=KA11y Network']);
  }
  const sites = wp(['site', 'list', '--field=path']).stdout;
  if (!sites.split('\n').some((line) => line.trim() === `/${subsite}/`)) {
    wp(['site', 'create', `--slug=${subsite}`, '--title=Subsite']);
  }
  wp(['plugin', 'activate', 'kotlinskidev-accessibility', '--network'], { allowFailure: true });
  wp(['rewrite', 'structure', '/%postname%/']);
  const encoded = Buffer.from(htaccess).toString('base64');
  wp(['eval', `file_put_contents( ABSPATH . '.htaccess', base64_decode( '${encoded}' ) );`]);
  process.stdout.write('Multisite wp-env ready at http://localhost:8891 (subsite /sub/)\n');
};

const stop = () => {
  run(['stop', `--config=${config}`]);
};

const commands = { start, stop };
const command = commands[process.argv[2] ?? ''];

if (command === undefined) {
  process.stderr.write('Usage: node bin/multisite-env.mjs <start|stop>\n');
  process.exit(1);
}

command();
