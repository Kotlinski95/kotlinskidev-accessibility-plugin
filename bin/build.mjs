import { build } from 'esbuild';
import * as sass from 'sass';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'build');
const watch = process.argv.includes('--dev');
const minify = !watch;

const wpGlobals = {
  '@wordpress/i18n': 'wp.i18n',
  '@wordpress/api-fetch': 'wp.apiFetch',
};

const wpHandles = {
  '@wordpress/i18n': 'wp-i18n',
  '@wordpress/api-fetch': 'wp-api-fetch',
};

const wpExternalsPlugin = {
  name: 'wp-externals',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@wordpress\/(i18n|api-fetch)$/ }, (args) => ({
      path: args.path,
      namespace: 'wp-external',
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'wp-external' }, (args) => ({
      contents: `module.exports = window.${wpGlobals[args.path]};`,
      loader: 'js',
    }));
  },
};

const bundles = [
  { entry: 'src/ts/bootstrap/index.ts', file: 'bootstrap.js', admin: false },
  { entry: 'src/ts/frontend/index.ts', file: 'frontend.js', admin: false },
  { entry: 'src/ts/admin/index.ts', file: 'admin.js', admin: true },
  { entry: 'src/ts/admin/alt-text-entry.ts', file: 'alt-text.js', admin: true },
];

const styles = [
  { entry: 'src/scss/page/index.scss', file: 'frontend.css' },
  { entry: 'src/scss/admin/index.scss', file: 'admin.css' },
  { entry: 'src/scss/widget/index.scss', file: 'widget.css' },
];

const hashOf = (content) => createHash('sha1').update(content).digest('hex').slice(0, 20);

const buildScript = async ({ entry, file, admin }, widgetCss) => {
  const outfile = resolve(out, file);
  const result = await build({
    entryPoints: [resolve(root, entry)],
    outfile,
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    minify,
    minifyIdentifiers: admin ? false : minify,
    plugins: admin ? [wpExternalsPlugin] : [],
    define: { __KA11Y_WIDGET_CSS__: JSON.stringify(widgetCss) },
    metafile: true,
    logLevel: 'warning',
  });

  const content = await readFile(outfile);
  const imported = Object.values(result.metafile.outputs).flatMap((output) =>
    output.imports.map((item) => item.path)
  );
  const used = Object.keys(wpHandles).filter((name) => imported.some((path) => path.includes(name)));
  const dependencies = admin
    ? [...new Set(['wp-i18n', 'wp-api-fetch', ...used.map((name) => wpHandles[name])])]
    : [];
  const php = `<?php return array( 'dependencies' => array( ${dependencies
    .map((handle) => `'${handle}'`)
    .join(', ')} ), 'version' => '${hashOf(content)}' );\n`;
  await writeFile(resolve(out, file.replace(/\.js$/, '.asset.php')), php);
};

const buildStyle = async ({ entry, file }) => {
  const result = sass.compile(resolve(root, entry), {
    style: minify ? 'compressed' : 'expanded',
  });
  await writeFile(resolve(out, file), result.css);
  return result.css;
};

const run = async () => {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const compiled = await Promise.all(styles.map(buildStyle));
  const widgetCss = compiled[styles.findIndex((style) => style.file === 'widget.css')] ?? '';
  await Promise.all(bundles.map((bundle) => buildScript(bundle, widgetCss)));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
