import { build } from 'esbuild';
import * as sass from 'sass';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const readBuilt = (file) => readFile(resolve(out, file));

const run = async () => {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
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
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
