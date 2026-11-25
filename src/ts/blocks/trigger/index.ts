interface Option {
  label: string;
  value: string;
}

interface Attributes {
  action: string;
  label: string;
  element: 'button' | 'link';
  showIcon: boolean;
}

interface SchemaLists {
  features: string[];
  profiles: string[];
}

type Create = (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown;

interface EditProps {
  attributes: Attributes;
  setAttributes: (next: Partial<Attributes>) => void;
}

interface WpGlobal {
  blocks: { registerBlockType: (name: string, settings: Record<string, unknown>) => void };
  blockEditor: { InspectorControls: unknown; useBlockProps: (props?: Record<string, unknown>) => Record<string, unknown> };
  components: Record<string, unknown>;
  element: { createElement: Create; useState: <T>(initial: T) => [T, (value: T) => void]; useEffect: (effect: () => void, deps: unknown[]) => void };
  i18n: { __: (text: string, domain?: string) => string };
  apiFetch: <T>(options: { path: string }) => Promise<T>;
  hooks: { addFilter: (hook: string, namespace: string, callback: (settings: Record<string, unknown>, name: string) => Record<string, unknown>) => void };
}

const wp = (window as unknown as { wp: WpGlobal }).wp;
const NAME = 'kotlinskidev-a11y/trigger';
const DOMAIN = 'kotlinskidev-accessibility';
const SCHEMA_PATH = '/kotlinskidev-a11y/v1/schema';
const BASE_ACTIONS = ['open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show'];
const LEVELS = ['1', '2', '3', '4'];
const { createElement: h, useState, useEffect } = wp.element;
const { __ } = wp.i18n;

const toOptions = (values: string[], prefix = '', title = ''): Option[] =>
  values.map((value) => ({
    label: title === '' ? value : `${title}: ${value}`,
    value: prefix === '' ? value : `${prefix}:${value}`,
  }));

const levelOf = (action: string): string => (action.startsWith('feature:') ? (action.split(':')[2] ?? '') : '');

const keyOf = (action: string): string => action.split(':').slice(0, 2).join(':');

const useSchema = (): SchemaLists => {
  const [lists, setLists] = useState<SchemaLists>({ features: [], profiles: [] });
  useEffect(() => {
    wp.apiFetch<SchemaLists>({ path: SCHEMA_PATH })
      .then((schema) => setLists({ features: schema.features, profiles: schema.profiles }))
      .catch(() => undefined);
  }, []);
  return lists;
};

const edit = ({ attributes, setAttributes }: EditProps): unknown => {
  const { SelectControl, TextControl, RadioControl, ToggleControl, PanelBody } = wp.components as Record<string, unknown>;
  const lists = useSchema();
  const actions: Option[] = [
    ...toOptions(BASE_ACTIONS),
    ...toOptions(lists.features, 'feature', __('Feature', DOMAIN)),
    ...toOptions(lists.profiles, 'profile', __('Profile', DOMAIN)),
  ];
  const isFeature = attributes.action.startsWith('feature:');
  const label = attributes.label === '' ? attributes.action : attributes.label;
  const onAction = (value: string): void => setAttributes({ action: value });
  const onLevel = (value: string): void => setAttributes({ action: value === '' ? keyOf(attributes.action) : `${keyOf(attributes.action)}:${value}` });

  const controls = h(
    wp.blockEditor.InspectorControls,
    null,
    h(
      PanelBody,
      { title: __('Trigger', DOMAIN) },
      h(SelectControl, { label: __('Action', DOMAIN), value: keyOf(attributes.action), options: actions, onChange: onAction }),
      isFeature
        ? h(SelectControl, {
            label: __('Level', DOMAIN),
            value: levelOf(attributes.action),
            options: [{ label: __('Default', DOMAIN), value: '' }, ...LEVELS.map((value) => ({ label: value, value }))],
            onChange: onLevel,
          })
        : null,
      h(TextControl, { label: __('Label', DOMAIN), value: attributes.label, onChange: (value: string) => setAttributes({ label: value }) }),
      h(RadioControl, {
        label: __('Element', DOMAIN),
        selected: attributes.element,
        options: [
          { label: __('Button', DOMAIN), value: 'button' },
          { label: __('Link', DOMAIN), value: 'link' },
        ],
        onChange: (value: 'button' | 'link') => setAttributes({ element: value }),
      }),
      h(ToggleControl, { label: __('Show icon', DOMAIN), checked: attributes.showIcon, onChange: (value: boolean) => setAttributes({ showIcon: value }) })
    )
  );

  const blockProps = wp.blockEditor.useBlockProps();
  const preview =
    attributes.element === 'link'
      ? h('a', { className: 'ka11y-trigger', href: '#', role: 'button', onClick: (event: Event) => event.preventDefault() }, label)
      : h('button', { className: 'ka11y-trigger', type: 'button' }, label);
  return h('div', blockProps, controls, preview);
};

wp.blocks.registerBlockType(NAME, { edit, save: () => null });

wp.hooks.addFilter('blocks.registerBlockType', `${NAME}/navigation`, (settings, name) =>
  name === 'core/navigation'
    ? { ...settings, allowedBlocks: [...((settings.allowedBlocks as string[] | undefined) ?? []), NAME] }
    : settings
);
