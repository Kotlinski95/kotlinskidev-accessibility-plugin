import { expect, test } from './support/fixtures';
import { wpCli } from './support/wp-cli';

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface ExecError {
  status?: number | null;
  stdout?: string;
  stderr?: string;
}

const NOISE = /^(ℹ|✔|✖)/u;
const EXPORT_FILE = '/tmp/ka11y-cli-export.json';
const CAPABILITY = 'kotlinskidev_a11y_customize';

const run = (...args: string[]): CliResult => {
  try {
    return { status: 0, stdout: wpCli(...args), stderr: '' };
  } catch (error) {
    const failure = error as ExecError;
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
};

const payload = (result: CliResult): string =>
  result.stdout
    .split('\n')
    .filter((line) => !NOISE.test(line))
    .join('\n')
    .trim();

const json = (result: CliResult): unknown => JSON.parse(payload(result));

const combined = (result: CliResult): string => `${result.stdout}\n${result.stderr}`;

interface ChangeRow {
  path: string;
  before: unknown;
  after: unknown;
}

interface DoctorRow {
  id: string;
  status: string;
  label: string;
  description: string;
  actions: unknown[];
}

interface AccessRow {
  role: string;
  capability: string;
}

test.describe('wp ka11y', () => {
  test.beforeEach(() => {
    run('ka11y', 'settings', 'reset', '--yes', '--quiet');
    run('cap', 'remove', 'subscriber', CAPABILITY);
  });

  test.afterAll(() => {
    run('ka11y', 'settings', 'reset', '--yes', '--quiet');
    run('cap', 'remove', 'subscriber', CAPABILITY);
  });

  test('help shows a synopsis for every settings subcommand', () => {
    for (const subcommand of ['get', 'set', 'import', 'export', 'reset']) {
      const help = combined(run('help', 'ka11y', 'settings', subcommand));
      expect(help, subcommand).toContain('SYNOPSIS');
      expect(help, subcommand).toContain(`wp ka11y settings ${subcommand}`);
    }
    expect(combined(run('help', 'ka11y', 'settings', 'set'))).toContain('<path> <value>');
    expect(combined(run('help', 'ka11y', 'doctor'))).toContain('--fail-on=<fail-on>');
    for (const subcommand of ['grant', 'revoke', 'list']) {
      expect(combined(run('help', 'ka11y', 'access', subcommand))).toContain('SYNOPSIS');
    }
  });

  test('get reads a leaf, a group and a layer', () => {
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');
    expect(json(run('ka11y', 'settings', 'get', 'widget.position', '--quiet'))).toEqual({
      widget: { position: { desktop: 'bottom-right', tablet: 'bottom-right', mobile: 'bottom-right' } },
    });
    expect(run('ka11y', 'settings', 'get', 'widget.size', '--layer=stored').status).toBe(1);
    expect(run('ka11y', 'settings', 'get', '--layer=nope').status).toBe(1);
  });

  test('set validates, saves and reports the change as JSON', () => {
    const saved = run('ka11y', 'settings', 'set', 'widget.size', 'lg', '--format=json', '--quiet');
    expect(saved.status).toBe(0);
    expect(json(saved)).toEqual([{ path: 'widget.size', before: 'md', after: 'lg' } satisfies ChangeRow]);
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('lg');
  });

  test('set --dry-run saves nothing', () => {
    const dry = run('ka11y', 'settings', 'set', 'widget.size', 'sm', '--dry-run', '--format=json', '--quiet');
    expect(dry.status).toBe(0);
    expect((json(dry) as ChangeRow[])[0]?.after).toBe('sm');
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');
  });

  test('set rejects bad input with exit 1 and saves nothing', () => {
    const enumeration = run('ka11y', 'settings', 'set', 'widget.size', 'xl');
    expect(enumeration.status).toBe(1);
    expect(combined(enumeration)).toContain('sm, md, lg');

    const range = run('ka11y', 'settings', 'set', 'widget.offsetX.desktop', '501');
    expect(range.status).toBe(1);
    expect(combined(range)).toContain('between 0 and 500');

    const unknown = run('ka11y', 'settings', 'set', 'widget.sze', 'lg');
    expect(unknown.status).toBe(1);
    expect(combined(unknown)).toContain('Did you mean widget.size?');

    const group = run('ka11y', 'settings', 'set', 'widget', 'lg');
    expect(group.status).toBe(1);

    const list = run('ka11y', 'settings', 'set', 'profiles.visionImpaired.features', 'biggerText');
    expect(list.status).toBe(1);
    expect(combined(list)).toContain('--as-json');

    const sanitized = run('ka11y', 'settings', 'set', 'profiles.visionImpaired.features', '["biggerText","bogus"]', '--as-json');
    expect(sanitized.status).toBe(1);
    expect(combined(sanitized)).toContain('["biggerText"]');

    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');
  });

  test('set accepts a JSON list', () => {
    const saved = run('ka11y', 'settings', 'set', 'profiles.visionImpaired.features', '["biggerText"]', '--as-json', '--format=json', '--quiet');
    expect(saved.status).toBe(0);
    expect(json(run('ka11y', 'settings', 'get', 'profiles.visionImpaired.features', '--quiet'))).toEqual(['biggerText']);
  });

  test('locked paths are refused with a clear error', () => {
    const locked = run('--exec=define("KOTLINSKIDEV_A11Y_LOCKED_SETTINGS",array("widget.size"=>"sm"));', 'ka11y', 'settings', 'set', 'widget.size', 'lg');
    expect(locked.status).toBe(1);
    expect(combined(locked)).toContain('Locked by site configuration: widget.size');

    const reset = run('--exec=define("KOTLINSKIDEV_A11Y_LOCKED_SETTINGS",array("widget.size"=>"sm"));', 'ka11y', 'settings', 'reset', 'widget.size', '--yes');
    expect(reset.status).toBe(1);
    expect(combined(reset)).toContain('Locked by site configuration');
  });

  test('reset restores a path and dry-run previews it', () => {
    run('ka11y', 'settings', 'set', 'widget.size', 'lg', '--quiet');
    const preview = run('ka11y', 'settings', 'reset', 'widget.size', '--dry-run', '--format=json', '--quiet');
    expect(json(preview)).toEqual([{ path: 'widget.size', before: 'lg', after: 'md' }]);
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('lg');

    expect(run('ka11y', 'settings', 'reset', 'widget.size', '--yes', '--quiet').status).toBe(0);
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');
    expect(run('ka11y', 'settings', 'reset', 'nothing', '--yes').status).toBe(1);
  });

  test('export then import round-trips through the versioned envelope', () => {
    run('ka11y', 'settings', 'set', 'widget.size', 'lg', '--quiet');

    const exported = run('ka11y', 'settings', 'export', `--file=${EXPORT_FILE}`, '--force', '--quiet');
    expect(exported.status).toBe(0);
    expect(run('ka11y', 'settings', 'export', `--file=${EXPORT_FILE}`).status).toBe(1);
    expect(run('ka11y', 'settings', 'export', `--file=${EXPORT_FILE}`, '--force', '--quiet').status).toBe(0);

    const envelope = json(run('ka11y', 'settings', 'export', '--quiet')) as { format: string; formatVersion: number; settings: { widget: { size: string } } };
    expect(envelope.format).toBe('kotlinskidev-accessibility-settings');
    expect(envelope.formatVersion).toBe(1);
    expect(envelope.settings.widget.size).toBe('lg');

    run('ka11y', 'settings', 'reset', '--yes', '--quiet');
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');

    const dry = run('ka11y', 'settings', 'import', EXPORT_FILE, '--dry-run', '--format=json', '--quiet');
    expect(dry.status).toBe(0);
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('md');

    const imported = run('ka11y', 'settings', 'import', EXPORT_FILE, '--yes', '--format=json', '--quiet');
    expect(imported.status).toBe(0);
    expect(json(run('ka11y', 'settings', 'get', 'widget.size', '--quiet'))).toBe('lg');
  });

  test('import refuses remote paths and missing files', () => {
    expect(run('ka11y', 'settings', 'import', 'https://example.test/settings.json', '--yes').status).toBe(1);
    expect(run('ka11y', 'settings', 'import', '/tmp/ka11y-does-not-exist.json', '--yes').status).toBe(1);
  });

  test('doctor lists every check and exits 0 when none is critical', () => {
    const result = run('ka11y', 'doctor', '--format=json', '--quiet');
    expect(result.status).toBe(0);
    const rows = json(result) as DoctorRow[];
    expect(rows.map((row) => row.id)).toContain('kotlinskidev_a11y_build_files');
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(['id', 'status', 'label', 'description', 'actions']);
      expect(['good', 'recommended', 'critical']).toContain(row.status);
      expect(Array.isArray(row.actions)).toBe(true);
    }
    expect(run('ka11y', 'doctor').status).toBe(0);
    expect(run('ka11y', 'doctor', '--fail-on=nope').status).toBe(1);
  });

  test('access grant, list and revoke manage the customer capability', () => {
    expect(run('ka11y', 'access', 'grant', 'ghost').status).toBe(1);
    expect(run('ka11y', 'access', 'grant', 'subscriber', '--quiet').status).toBe(0);

    const listed = json(run('ka11y', 'access', 'list', '--format=json', '--quiet')) as AccessRow[];
    expect(listed).toContainEqual({ role: 'subscriber', capability: CAPABILITY });

    expect(run('ka11y', 'access', 'revoke', 'subscriber', '--quiet').status).toBe(0);
    const after = json(run('ka11y', 'access', 'list', '--format=json', '--quiet')) as AccessRow[];
    expect(after.map((row) => row.role)).not.toContain('subscriber');
    expect(run('ka11y', 'access', 'revoke', 'ghost').status).toBe(1);
  });

  test('no command prints an update token', () => {
    const outputs = [
      combined(run('ka11y', 'settings', 'get')),
      combined(run('ka11y', 'settings', 'export')),
      combined(run('ka11y', 'doctor', '--format=json')),
      combined(run('ka11y', 'access', 'list')),
    ];
    for (const output of outputs) {
      expect(output.toLowerCase()).not.toContain('updatetoken');
      expect(output.toLowerCase()).not.toMatch(/ghp_|github_pat_/u);
    }
  });
});
