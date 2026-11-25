type Filter = (settings: Record<string, unknown>, name: string) => Record<string, unknown>;

const loadBlock = async (): Promise<{ filter: Filter; fetched: string[]; register: jest.Mock }> => {
  const fetched: string[] = [];
  const hooks = jest.fn();
  const register = jest.fn();
  const element = {
    createElement: jest.fn(),
    useState: <T,>(initial: T): [T, (value: T) => void] => [initial, jest.fn()],
    useEffect: (effect: () => void): void => effect(),
  };
  (window as unknown as { wp: unknown }).wp = {
    blocks: { registerBlockType: register },
    blockEditor: { InspectorControls: 'inspector', useBlockProps: () => ({}) },
    components: {},
    element,
    i18n: { __: (text: string) => text },
    apiFetch: (options: { path: string }) => {
      fetched.push(options.path);
      return Promise.resolve({ features: [], profiles: [] });
    },
    hooks: { addFilter: hooks },
  };
  jest.resetModules();
  await import('../../src/ts/blocks/trigger');
  return { filter: hooks.mock.calls[0][2] as Filter, fetched, register };
};

describe('trigger block editor', () => {
  it('reads the options from the editor-capable route, not the admin schema', async () => {
    const { register, fetched } = await loadBlock();
    const settings = register.mock.calls[0][1] as { edit: (props: unknown) => unknown };
    settings.edit({ attributes: { action: 'open', label: '', element: 'button', showIcon: false }, setAttributes: jest.fn() });
    expect(fetched).toEqual(['/kotlinskidev-a11y/v1/trigger-options']);
  });
});

describe('trigger block navigation filter', () => {
  it('appends the block to an existing allowed list once', async () => {
    const { filter } = await loadBlock();
    const settings = { allowedBlocks: ['core/navigation-link'] };
    const next = filter(settings, 'core/navigation');
    expect(next.allowedBlocks).toEqual(['core/navigation-link', 'kotlinskidev-a11y/trigger']);
    expect(filter(next, 'core/navigation')).toBe(next);
  });

  it('leaves an undefined allowed list alone so every block stays allowed', async () => {
    const { filter } = await loadBlock();
    const settings = { title: 'Navigation' };
    expect(filter(settings, 'core/navigation')).toBe(settings);
  });

  it('ignores other blocks', async () => {
    const { filter } = await loadBlock();
    const settings = { allowedBlocks: ['a'] };
    expect(filter(settings, 'core/group')).toBe(settings);
  });
});
