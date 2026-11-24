import { comboFromEvent, createComboField } from '../../../src/ts/admin/fields/combo';
import { createChecklistField } from '../../../src/ts/admin/fields/checklist';
import { createColorField, isColor } from '../../../src/ts/admin/fields/color';
import { createDeviceMatrixField } from '../../../src/ts/admin/fields/device-matrix';
import { createMediaField } from '../../../src/ts/admin/fields/media';
import { createNumberField } from '../../../src/ts/admin/fields/number';
import { createSelectField } from '../../../src/ts/admin/fields/select';
import { createTextField } from '../../../src/ts/admin/fields/text';
import { createTextListField } from '../../../src/ts/admin/fields/text-list';
import { createTextareaField } from '../../../src/ts/admin/fields/textarea';
import { createToggleField } from '../../../src/ts/admin/fields/toggle';
import { createFormState } from '../../../src/ts/admin/state';
import type { MediaFrame } from '../../../src/ts/admin/types';
import { at, change, press, sampleConfig, sampleDefaults, sampleSchema } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const context = () => ({ state: createFormState(sampleDefaults()), schema: sampleSchema(), config: sampleConfig() });

describe('toggle field', () => {
  it('reads and writes', () => {
    const ctx = context();
    const field = createToggleField(ctx, { path: 'widget.iconBorder', label: 'Border' });
    const input = field.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBe(false);
    expect(field.querySelector('label')?.getAttribute('for')).toBe(input.id);
    input.checked = true;
    change(input, 'change');
    expect(ctx.state.get('widget.iconBorder')).toBe(true);
  });

  it('bare mode returns a labelled input', () => {
    const input = createToggleField(context(), { path: 'theme.followPrefersColorScheme', label: 'Follow', bare: true });
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-label')).toBe('Follow');
    expect((input as HTMLInputElement).checked).toBe(true);
  });
});

describe('select field', () => {
  const choices = [
    { value: false, label: 'Off' },
    { value: true, label: 'On' },
    { value: 2, label: 'Two' },
  ];

  it('reads the current choice and writes typed values', () => {
    const ctx = context();
    ctx.state.set('features.biggerText.default', 2);
    const field = createSelectField(ctx, { path: 'features.biggerText.default', label: 'Default', choices });
    const select = field.querySelector('select') as HTMLSelectElement;
    expect(select.selectedIndex).toBe(2);
    select.selectedIndex = 1;
    change(select, 'change');
    expect(ctx.state.get('features.biggerText.default')).toBe(true);
    select.selectedIndex = 0;
    change(select, 'change');
    expect(ctx.state.get('features.biggerText.default')).toBe(false);
  });
});

describe('number field', () => {
  it('applies definition bounds and writes integers', () => {
    const ctx = context();
    const field = createNumberField(ctx, { path: 'storage.ttlDays', label: 'TTL' });
    const input = field.querySelector('input') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('3650');
    expect(input.value).toBe('365');
    input.value = '30';
    change(input);
    expect(ctx.state.get('storage.ttlDays')).toBe(30);
    input.value = '';
    change(input);
    expect(ctx.state.get('storage.ttlDays')).toBe(30);
  });
});

describe('text and textarea fields', () => {
  it('write strings', () => {
    const ctx = context();
    const text = createTextField(ctx, { path: 'storage.key', label: 'Key' }).querySelector('input') as HTMLInputElement;
    expect(text.value).toBe('ka11y');
    text.value = 'mykey';
    change(text);
    expect(ctx.state.get('storage.key')).toBe('mykey');

    const area = createTextareaField(ctx, { path: 'customCss', label: 'CSS', code: true }).querySelector('textarea') as HTMLTextAreaElement;
    area.value = 'a{color:red}';
    change(area);
    expect(ctx.state.get('customCss')).toBe('a{color:red}');
  });

  it('links help text with aria-describedby', () => {
    const field = createTextField(context(), { path: 'storage.key', label: 'Key', help: 'Help me' });
    const input = field.querySelector('input') as HTMLInputElement;
    expect(document.createElement('div').appendChild(field).querySelector(`[id="${input.getAttribute('aria-describedby')}"]`)?.textContent).toBe('Help me');
  });
});

describe('color field', () => {
  it('syncs picker and text, rejects invalid values', () => {
    const ctx = context();
    const field = createColorField(ctx, { path: 'tokens.primary', label: 'Primary' });
    const picker = field.querySelector('input[type="color"]') as HTMLInputElement;
    const text = field.querySelector('input[type="text"]') as HTMLInputElement;
    expect(text.value).toBe('#0b57d0');
    picker.value = '#ff0000';
    change(picker);
    expect(text.value).toBe('#ff0000');
    expect(ctx.state.get('tokens.primary')).toBe('#ff0000');
    text.value = 'nope';
    change(text);
    expect(text.getAttribute('aria-invalid')).toBe('true');
    expect(ctx.state.get('tokens.primary')).toBe('#ff0000');
    text.value = '#00ff00';
    change(text);
    expect(text.hasAttribute('aria-invalid')).toBe(false);
    expect(picker.value).toBe('#00ff00');
    expect(ctx.state.get('tokens.primary')).toBe('#00ff00');
  });

  it('validates colors', () => {
    expect(isColor('#fff')).toBe(true);
    expect(isColor('#ffffff80')).toBe(true);
    expect(isColor('red')).toBe(false);
  });
});

describe('text list field', () => {
  it('adds and removes numeric items', () => {
    const ctx = context();
    const field = createTextListField(ctx, { path: 'visibility.excludePostIds', label: 'IDs', numeric: true });
    document.body.replaceChildren(field);
    const input = field.querySelector('input') as HTMLInputElement;
    const add = [...field.querySelectorAll('button')].find((item) => item.textContent === 'Add') as HTMLButtonElement;
    input.value = '12';
    add.click();
    input.value = 'abc';
    add.click();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = '12';
    add.click();
    input.value = '7';
    press(input, 'Enter');
    expect(ctx.state.get('visibility.excludePostIds')).toEqual([12, 7]);
    expect(field.querySelectorAll('li')).toHaveLength(2);
    (field.querySelector('.ka11y-list__remove') as HTMLButtonElement).click();
    expect(ctx.state.get('visibility.excludePostIds')).toEqual([7]);
  });

  it('handles text items', () => {
    const ctx = context();
    const field = createTextListField(ctx, { path: 'visibility.excludeRoles', label: 'Roles' });
    const input = field.querySelector('input') as HTMLInputElement;
    input.value = '  editor ';
    press(input, 'Enter');
    expect(ctx.state.get('visibility.excludeRoles')).toEqual(['editor']);
  });
});

describe('checklist field', () => {
  it('keeps selections in choice order', () => {
    const ctx = context();
    const choices = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ];
    ctx.state.set('profiles.visionImpaired.features', ['c']);
    const field = createChecklistField(ctx, { path: 'profiles.visionImpaired.features', label: 'List', choices });
    const boxes = [...field.querySelectorAll('input')] as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([false, false, true]);
    at(boxes, 0).checked = true;
    change(at(boxes, 0), 'change');
    expect(ctx.state.get('profiles.visionImpaired.features')).toEqual(['a', 'c']);
    at(boxes, 2).checked = false;
    change(at(boxes, 2), 'change');
    expect(ctx.state.get('profiles.visionImpaired.features')).toEqual(['a']);
  });
});

describe('device matrix field', () => {
  it('renders one row per device and writes per device paths', () => {
    const ctx = context();
    const field = createDeviceMatrixField(ctx, {
      label: 'Placement',
      deviceHeader: 'Device',
      devices: ['desktop', 'tablet', 'mobile'],
      deviceLabel: (device) => device,
      columns: [
        { basePath: 'widget.position', label: 'Position', kind: 'select', choices: [{ value: 'bottom-right', label: 'BR' }, { value: 'top-left', label: 'TL' }] },
        { basePath: 'widget.offsetX', label: 'X', kind: 'number' },
        { basePath: 'visibility.devices', label: 'Visible', kind: 'toggle' },
      ],
    });
    expect(field.querySelector('legend')?.textContent).toBe('Placement');
    expect(field.querySelectorAll('tbody tr')).toHaveLength(3);
    const tablet = field.querySelectorAll('tbody tr')[1] as HTMLElement;
    const select = tablet.querySelector('select') as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).toBe('Position: tablet');
    select.selectedIndex = 1;
    change(select, 'change');
    const number = tablet.querySelector('input[type="number"]') as HTMLInputElement;
    number.value = '44';
    change(number);
    const toggle = tablet.querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.checked = false;
    change(toggle, 'change');
    expect(ctx.state.get('widget.position.tablet')).toBe('top-left');
    expect(ctx.state.get('widget.offsetX.tablet')).toBe(44);
    expect(ctx.state.get('visibility.devices.tablet')).toBe(false);
    expect(ctx.state.get('widget.position.desktop')).toBe('bottom-right');
  });
});

describe('media field', () => {
  afterEach(() => {
    delete window.wp;
  });

  it('stores the chosen attachment and can revert to default', () => {
    const ctx = context();
    const frame: MediaFrame = {
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'select') callback();
        return frame;
      }),
      open: jest.fn(),
      state: () => ({ get: () => ({ first: () => ({ toJSON: () => ({ id: 42, url: 'https://example.test/i.png' }) }) }) }),
    };
    window.wp = { media: jest.fn(() => frame) };
    const field = createMediaField(ctx, { path: 'widget.icon', label: 'Icon' });
    const buttons = [...field.querySelectorAll('button')];
    expect(field.querySelector('.ka11y-media__status')?.textContent).toBe('Default icon');
    at(buttons, 0).click();
    expect(ctx.state.get('widget.icon')).toBe(42);
    expect(field.querySelector('.ka11y-media__status')?.textContent).toBe('Attachment #42');
    expect((field.querySelector('img') as HTMLImageElement).hidden).toBe(false);
    at(buttons, 1).click();
    expect(ctx.state.get('widget.icon')).toBe('universal');
  });

  it('does nothing without wp.media', () => {
    const ctx = context();
    const field = createMediaField(ctx, { path: 'widget.icon', label: 'Icon' });
    (field.querySelector('button') as HTMLButtonElement).click();
    expect(ctx.state.get('widget.icon')).toBe('universal');
  });
});

describe('combo field', () => {
  it('builds combos from key events', () => {
    expect(comboFromEvent(new KeyboardEvent('keydown', { key: 'a', altKey: true, shiftKey: true }))).toBe('Alt+Shift+A');
    expect(comboFromEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))).toBeNull();
    expect(comboFromEvent(new KeyboardEvent('keydown', { key: 'a' }))).toBeNull();
  });

  it('records a new shortcut and cancels on Escape', () => {
    const ctx = context();
    const field = createComboField(ctx, { path: 'shortcut.combo', label: 'Combo' });
    document.body.replaceChildren(field);
    const display = field.querySelector('input') as HTMLInputElement;
    const record = field.querySelector('button') as HTMLButtonElement;
    expect(display.value).toBe('Alt+Shift+A');
    record.click();
    expect(record.getAttribute('aria-pressed')).toBe('true');
    press(display, 'k', { ctrlKey: true });
    expect(ctx.state.get('shortcut.combo')).toBe('Ctrl+K');
    expect(display.value).toBe('Ctrl+K');
    expect(record.getAttribute('aria-pressed')).toBe('false');
    record.click();
    press(display, 'Escape');
    expect(ctx.state.get('shortcut.combo')).toBe('Ctrl+K');
    expect(record.getAttribute('aria-pressed')).toBe('false');
  });
});
