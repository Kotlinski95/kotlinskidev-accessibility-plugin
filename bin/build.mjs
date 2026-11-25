import { build } from 'esbuild';
import * as sass from 'sass';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKsesSafeCss,
  assertLoaderIndependent,
  assertWrapperPrefix,
  assertSingleOwnership,
  assertUniqueKernelExports,
  fileEntry,
  kernelExternalPlugin,
  writeManifest,
  wrapChunk,
} from './lib-chunks.mjs';
import { findBareStateSelectors, readFeatureKeys } from './lib-scss-scope.mjs';

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

const bootstrapEntry = { entry: 'src/ts/bootstrap/index.ts', file: 'bootstrap.js' };

const bundles = [
  { entry: 'src/ts/admin/index.ts', file: 'admin.js' },
  { entry: 'src/ts/admin/alt-text-entry.ts', file: 'alt-text.js' },
];

const chunks = [
  { name: 'kernel', file: 'kernel.js', kernel: true },
  { name: 'panel', file: 'panel.js', entry: 'src/ts/frontend/chunks/panel.ts', widgetCss: true },
  { name: 'content', file: 'content.js', entry: 'src/ts/frontend/chunks/content.ts' },
  { name: 'color', file: 'color.js', entry: 'src/ts/frontend/chunks/color.ts' },
  { name: 'orientation', file: 'orientation.js', entry: 'src/ts/frontend/chunks/orientation.ts' },
];

const kernelEntry = {
  contents: "export * from './exports';\nexport { bootKernel } from './index';\n",
  resolveDir: resolve(root, 'src/ts/frontend/kernel'),
  sourcefile: 'src/ts/frontend/kernel/chunk-entry.ts',
  loader: 'ts',
};

const LOADER_ENTRY = 'src/ts/loader/index.ts';

const styles = [
  { entry: 'src/scss/page/index.scss', file: 'frontend.css' },
  { entry: 'src/scss/launcher/index.scss', file: 'launcher.css' },
  { entry: 'src/scss/widget/index.scss', file: 'widget.css' },
  { entry: 'src/scss/admin/index.scss', file: 'admin.css' },
];

const sharedBuildOptions = {
  bundle: true,
  target: 'es2022',
  platform: 'browser',
  minify,
  metafile: true,
  logLevel: 'warning',
  absWorkingDir: root,
};

const hashOf = (content) => createHash('sha1').update(content).digest('hex').slice(0, 20);

const runtimeAbi = async () => {
  const source = await readFile(resolve(root, 'src/ts/shared/runtime.ts'), 'utf8');
  const match = /RUNTIME_ABI\s*=\s*(\d+)/.exec(source);
  if (!match) throw new Error('RUNTIME_ABI not found in src/ts/shared/runtime.ts');
  return Number(match[1]);
};

const featureGroupMap = async () => {
  const result = await build({
    entryPoints: [resolve(root, 'src/ts/frontend/feature-groups.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'warning',
  });
  const source = result.outputFiles[0].text;
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return Object.fromEntries(
    module.FEATURE_GROUPS.flatMap((group) => group.features.map((key) => [key, group.id]))
  );
};

const buildAdminScript = async ({ entry, file }) => {
  const outfile = resolve(out, file);
  const result = await build({
    ...sharedBuildOptions,
    entryPoints: [resolve(root, entry)],
    outfile,
    format: 'iife',
    minifyIdentifiers: false,
    plugins: [wpExternalsPlugin],
  });

  const content = await readFile(outfile);
  const imported = Object.values(result.metafile.outputs).flatMap((output) =>
    output.imports.map((item) => item.path)
  );
  const used = Object.keys(wpHandles).filter((name) => imported.some((path) => path.includes(name)));
  const dependencies = [...new Set(['wp-i18n', 'wp-api-fetch', ...used.map((name) => wpHandles[name])])];
  const php = `<?php return array( 'dependencies' => array( ${dependencies
    .map((handle) => `'${handle}'`)
    .join(', ')} ), 'version' => '${hashOf(content)}' );\n`;
  await writeFile(resolve(out, file.replace(/\.js$/, '.asset.php')), php);
};

const blockGlobals = {
  'wp-blocks': 'wp.blocks',
  'wp-block-editor': 'wp.blockEditor',
  'wp-components': 'wp.components',
  'wp-element': 'wp.element',
  'wp-i18n': 'wp.i18n',
  'wp-api-fetch': 'wp.apiFetch',
  'wp-hooks': 'wp.hooks',
};

const buildTriggerBlock = async () => {
  const dir = resolve(out, 'blocks/trigger');
  await mkdir(dir, { recursive: true });
  await copyFile(resolve(root, 'src/blocks/trigger/block.json'), resolve(dir, 'block.json'));
  const outfile = resolve(dir, 'index.js');
  await build({
    ...sharedBuildOptions,
    entryPoints: [resolve(root, 'src/ts/blocks/trigger/index.ts')],
    outfile,
    format: 'iife',
  });
  const content = await readFile(outfile);
  const dependencies = Object.keys(blockGlobals)
    .map((handle) => `'${handle}'`)
    .join(', ');
  await writeFile(
    resolve(dir, 'index.asset.php'),
    `<?php return array( 'dependencies' => array( ${dependencies} ), 'version' => '${hashOf(content)}' );\n`
  );
};

const buildBootstrap = () =>
  build({
    ...sharedBuildOptions,
    entryPoints: [resolve(root, bootstrapEntry.entry)],
    outfile: resolve(out, bootstrapEntry.file),
    format: 'iife',
  });

const buildLoader = async (groups) => {
  const outfile = resolve(out, 'loader.js');
  const result = await build({
    ...sharedBuildOptions,
    entryPoints: [resolve(root, LOADER_ENTRY)],
    outfile,
    format: 'iife',
    define: { __KA11Y_GROUPS__: JSON.stringify(groups) },
  });
  assertLoaderIndependent(result.metafile);
  return result.metafile;
};

const buildChunk = async (chunk, widgetCss, abi) => {
  const result = await build({
    ...sharedBuildOptions,
    ...(chunk.kernel
      ? { stdin: kernelEntry }
      : { entryPoints: [resolve(root, chunk.entry)], plugins: [kernelExternalPlugin] }),
    write: false,
    outdir: out,
    format: 'iife',
    globalName: '__ka11yExports',
    define: { __KA11Y_WIDGET_CSS__: JSON.stringify(chunk.widgetCss ? widgetCss : '') },
  });
  const code = result.outputFiles[0].text;
  const wrapped = wrapChunk(chunk.name, code, abi);
  assertWrapperPrefix(chunk.name, wrapped);
  await writeFile(resolve(out, chunk.file), wrapped);
  return result.metafile;
};

const buildStyle = async ({ entry, file }) => {
  const result = sass.compile(resolve(root, entry), {
    style: minify ? 'compressed' : 'expanded',
  });
  await writeFile(resolve(out, file), result.css);
  return result.css;
};

const assertScopedPageCss = (css) => {
  const offenders = findBareStateSelectors(css, readFeatureKeys(resolve(root, 'src/php/Settings/Schema.php')));
  if (offenders.length > 0) {
    throw new Error(`Page CSS selectors match a bare <html> state class:\n${offenders.join('\n')}`);
  }
};

const ICON_PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]{1,1500}$/;
const ICON_ROOT_ATTRIBUTES = {
  xmlns: /^http:\/\/www\.w3\.org\/2000\/svg$/,
  viewBox: /^0 0 24 24$/,
  stroke: /^currentColor$/,
  'stroke-width': /^[0-9.]+$/,
  'stroke-linecap': /^round$/,
  'stroke-linejoin': /^round$/,
};

const parseAttributes = (source, allowed, name) => {
  const attributes = {};
  const rest = source.replace(/([\w:-]+)="([^"]*)"/g, (_, key, value) => {
    attributes[key] = value;
    return '';
  });
  if (rest.trim() !== '') throw new Error(`Icon ${name}: malformed attributes`);
  for (const [key, value] of Object.entries(attributes)) {
    if (!allowed[key]?.test(value)) throw new Error(`Icon ${name}: attribute ${key} is not allowed`);
  }
  return attributes;
};

const iconPathData = (name, svg) => {
  const tags = svg.match(/<[^>]*>/g) ?? [];
  if (svg.replace(/<[^>]*>/g, '').trim() !== '') throw new Error(`Icon ${name}: text content is not allowed`);
  const [open, ...rest] = tags;
  const close = rest.pop();
  const rootMatch = /^<svg\s+([^>]*)>$/.exec(open ?? '');
  if (!rootMatch || close !== '</svg>') throw new Error(`Icon ${name}: expected a single svg root`);
  const root = parseAttributes(rootMatch[1], ICON_ROOT_ATTRIBUTES, name);
  if (root.viewBox !== '0 0 24 24') throw new Error(`Icon ${name}: viewBox must be 0 0 24 24`);
  const paths = rest.map((tag) => {
    const match = /^<path\s+([^>]*?)\s*\/>$/.exec(tag);
    if (!match) throw new Error(`Icon ${name}: only path elements are allowed, found ${tag}`);
    const { d } = parseAttributes(match[1], { d: ICON_PATH_DATA }, name);
    if (d === undefined) throw new Error(`Icon ${name}: path without d`);
    return d.trim();
  });
  if (paths.length === 0) throw new Error(`Icon ${name}: no path found`);
  const joined = paths.join(' ');
  if (!ICON_PATH_DATA.test(joined)) throw new Error(`Icon ${name}: path data too long or invalid`);
  return joined;
};

const buildIconMap = async () => {
  const dir = process.env.KA11Y_ICONS_DIR ? resolve(process.env.KA11Y_ICONS_DIR) : resolve(root, 'src/icons');
  const files = (await readdir(dir)).filter((file) => file.endsWith('.svg')).sort();
  const icons = {};
  for (const file of files) {
    icons[file.slice(0, -4)] = iconPathData(file, await readFile(resolve(dir, file), 'utf8'));
  }
  return JSON.stringify({ v: 1, icons });
};

const readBuilt = (file) => readFile(resolve(out, file));

const run = async () => {
  const iconsJson = await buildIconMap();
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'icons.json'), iconsJson);
  const compiled = Object.fromEntries(
    await Promise.all(styles.map(async (style) => [style.file, await buildStyle(style)]))
  );
  assertScopedPageCss(compiled['frontend.css']);
  assertKsesSafeCss(compiled['launcher.css']);

  await assertUniqueKernelExports();
  const abi = await runtimeAbi();
  const groups = await featureGroupMap();
  const metafiles = { loader: await buildLoader(groups) };

  for (const chunk of chunks) {
    metafiles[chunk.name] = await buildChunk(chunk, compiled['widget.css'], abi);
  }
  assertSingleOwnership(metafiles);

  await buildBootstrap();
  await Promise.all(bundles.map(buildAdminScript));
  await buildTriggerBlock();

  const scriptNames = ['loader', ...chunks.map((chunk) => chunk.name)];
  const scripts = Object.fromEntries(
    await Promise.all(scriptNames.map(async (name) => [name, fileEntry(`${name}.js`, await readBuilt(`${name}.js`))]))
  );
  const entryOf = async (file) => fileEntry(file, await readBuilt(file));
  await writeManifest(out, {
    abi,
    scripts,
    styles: { page: await entryOf('frontend.css'), launcher: await entryOf('launcher.css') },
    inline: { bootstrap: await entryOf('bootstrap.js') },
    data: { icons: await entryOf('icons.json') },
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
