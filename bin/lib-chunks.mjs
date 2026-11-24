import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = resolve(root, 'src/ts/frontend');
const posix = (path) => path.split(sep).join('/');

const kernelFileNames = [
  'apply',
  'dom',
  'feature-groups',
  'feature-utils',
  'features/color-orientation/focus-target',
  'features/color-orientation/landmarks',
  'features/color-orientation/overlay',
  'features/color-orientation/root-class',
  'profile-levels',
  'profiles',
  'root',
  'storage',
  'store',
];

export const KERNEL_FILES = kernelFileNames.map((name) => resolve(frontend, `${name}.ts`));

const KERNEL_ENTRY_FILES = [resolve(frontend, 'kernel/index.ts'), resolve(frontend, 'kernel/exports.ts')];

const SHARED_DIR = `${posix(relative(root, resolve(root, 'src/ts/shared')))}/`;

const kernelPaths = new Set([...KERNEL_FILES, ...KERNEL_ENTRY_FILES]);

export const hashOf = (content) => createHash('sha1').update(content).digest('hex').slice(0, 12);

export const gzipSize = (buffer) => gzipSync(buffer, { level: 9 }).length;

export const kernelExternalPlugin = {
  name: 'ka11y-kernel-external',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData?.ka11ySkip || args.kind === 'entry-point') return undefined;
      const resolved = await pluginBuild.resolve(args.path, {
        kind: args.kind,
        resolveDir: args.resolveDir,
        importer: args.importer,
        namespace: args.namespace,
        pluginData: { ka11ySkip: true },
      });
      if (resolved.errors.length > 0 || !kernelPaths.has(resolved.path)) return undefined;
      return { path: resolved.path, namespace: 'ka11y-kernel' };
    });
    pluginBuild.onLoad({ filter: /.*/, namespace: 'ka11y-kernel' }, () => ({
      contents: 'module.exports = __ka11yKernel;',
      loader: 'js',
    }));
  },
};

export const wrapChunk = (name, code, abi) =>
  `(window.kotlinskidevA11yRuntime=window.kotlinskidevA11yRuntime||{s:[],c:[]}).c.push([${JSON.stringify(name)},${abi},function(__ka11yKernel){${code.trimEnd()};return __ka11yExports}]);\n`;

const WRAPPER_PREFIX = '(window.kotlinskidevA11yRuntime=';

export const assertWrapperPrefix = (name, wrapped) => {
  if (!wrapped.startsWith(WRAPPER_PREFIX)) {
    throw new Error(`Chunk ${name} does not start with ${WRAPPER_PREFIX}`);
  }
};

export const assertSingleOwnership = (metafiles) => {
  const owners = new Map();
  Object.entries(metafiles).forEach(([chunk, metafile]) => {
    Object.keys(metafile.inputs)
      .filter((input) => input.startsWith('src/') && !input.startsWith(SHARED_DIR))
      .forEach((input) => owners.set(input, [...(owners.get(input) ?? []), chunk]));
  });
  const offenders = [...owners].filter(([, chunks]) => chunks.length > 1);
  if (offenders.length > 0) {
    throw new Error(
      `Source files bundled into more than one chunk (move shared files to KERNEL_FILES):\n${offenders
        .map(([input, chunks]) => `  ${input}: ${chunks.join(', ')}`)
        .join('\n')}`
    );
  }
};

export const assertLoaderIndependent = (metafile) => {
  const kernelInputs = new Set(
    [...KERNEL_FILES, ...KERNEL_ENTRY_FILES].map((path) => posix(relative(root, path)))
  );
  const offenders = Object.keys(metafile.inputs).filter((input) => kernelInputs.has(input));
  if (offenders.length > 0) {
    throw new Error(`The loader must not import kernel files:\n${offenders.map((input) => `  ${input}`).join('\n')}`);
  }
};

export const assertUniqueKernelExports = async () => {
  const seen = new Map();
  const duplicates = [];
  for (const file of KERNEL_FILES) {
    const result = await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      metafile: true,
      logLevel: 'silent',
    });
    const output = Object.values(result.metafile.outputs)[0];
    const label = posix(relative(root, file));
    (output?.exports ?? []).forEach((name) => {
      if (seen.has(name)) duplicates.push(`  ${name}: ${seen.get(name)}, ${label}`);
      else seen.set(name, label);
    });
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate kernel export names:\n${duplicates.join('\n')}`);
  }
};

export const assertKsesSafeCss = (css) => {
  const offender = /[<>&]/.exec(css);
  if (offender) {
    const start = Math.max(0, offender.index - 40);
    throw new Error(
      `launcher.css contains "${offender[0]}" which wp_kses would rewrite: ...${css.slice(start, offender.index + 40)}...`
    );
  }
};

export const fileEntry = (file, content) => ({
  file,
  ver: hashOf(content),
  raw: content.length,
  gzip: gzipSize(content),
});

const phpValue = (value, indent) => {
  const pad = '\t'.repeat(indent);
  if (Array.isArray(value)) return `array( ${value.map((item) => phpValue(item, indent)).join(', ')} )`;
  if (value !== null && typeof value === 'object') {
    const rows = Object.entries(value).map(
      ([key, item]) => `${pad}\t'${key}' => ${phpValue(item, indent + 1)},`
    );
    return `array(\n${rows.join('\n')}\n${pad})`;
  }
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return String(value);
};

export const writeManifest = async (outDir, entries) => {
  await writeFile(resolve(outDir, 'manifest.json'), `${JSON.stringify(entries, null, 2)}\n`);
  await writeFile(resolve(outDir, 'manifest.php'), `<?php return ${phpValue(entries, 0)};\n`);
};

export const optionalEntryExists = (entry) => existsSync(resolve(root, entry));
