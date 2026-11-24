import { createLocaleMapField } from '../../../src/ts/admin/fields/locale-map';
import { createFormState } from '../../../src/ts/admin/state';
import { at, change, sampleConfig, sampleDefaults, sampleSchema } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const context = (settings = sampleDefaults()) => ({ state: createFormState(settings), schema: sampleSchema(), config: sampleConfig() });

describe('locale map field', () => {
  it('renders one tab per locale with default text as placeholder', () => {
    const ctx = context();
    const field = createLocaleMapField(ctx, {
      path: 'labels',
      label: 'Labels',
      mode: 'strings',
      keys: ['open', 'panelTitle'],
      defaults: ctx.config.strings,
    });
    document.body.replaceChildren(field);
    const tabs = [...field.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['English (en_US)', 'Polski (pl_PL)']);
    const inputs = field.querySelectorAll<HTMLInputElement>('.ka11y-locale__input');
    expect(inputs[0]?.placeholder).toBe('Open accessibility settings');
    expect(inputs[1]?.placeholder).toBe('Accessibility settings');
  });

  it('edits overrides per locale without touching others', () => {
    const ctx = context();
    const field = createLocaleMapField(ctx, { path: 'labels', label: 'Labels', mode: 'strings', keys: ['open'], defaults: ctx.config.strings });
    const panels = field.querySelectorAll<HTMLElement>('[role="tabpanel"]');
    const polish = at(panels, 1).querySelector('.ka11y-locale__input') as HTMLInputElement;
    polish.value = 'Otworz ustawienia';
    change(polish);
    expect(ctx.state.get('labels.pl_PL')).toEqual({ open: 'Otworz ustawienia' });
    expect(ctx.state.get('labels.en_US')).toBeUndefined();
    polish.value = '';
    change(polish);
    expect(ctx.state.get('labels.pl_PL')).toEqual({ open: '' });
  });

  it('loads existing overrides and survives an empty-array labels option', () => {
    const settings = { ...sampleDefaults(), labels: [] as unknown as Record<string, unknown> };
    const ctx = context(settings);
    const field = createLocaleMapField(ctx, { path: 'labels', label: 'Labels', mode: 'strings', keys: ['open'], defaults: {} });
    const english = field.querySelector('.ka11y-locale__input') as HTMLInputElement;
    english.value = 'Hello';
    change(english);
    expect(JSON.parse(JSON.stringify(ctx.state.snapshot())).labels).toEqual({ en_US: { open: 'Hello' } });

    const loaded = context({ ...sampleDefaults(), labels: { en_US: { open: 'Preset' } } });
    const again = createLocaleMapField(loaded, { path: 'labels', label: 'Labels', mode: 'strings', keys: ['open'], defaults: {} });
    expect((again.querySelector('.ka11y-locale__input') as HTMLInputElement).value).toBe('Preset');
  });

  it('filters rows', () => {
    const ctx = context();
    const field = createLocaleMapField(ctx, {
      path: 'labels',
      label: 'Labels',
      mode: 'strings',
      keys: ['open', 'panelTitle'],
      defaults: ctx.config.strings,
    });
    const filter = field.querySelector('.ka11y-locale__filter') as HTMLInputElement;
    filter.value = 'panel';
    change(filter);
    const rows = field.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden]) .ka11y-locale__row');
    expect([...rows].map((row) => row.hidden)).toEqual([true, false]);
  });

  it('edits statement content per locale in document mode', () => {
    const ctx = context();
    const field = createLocaleMapField(ctx, { path: 'statement.content', label: 'Statement', mode: 'document' });
    const areas = field.querySelectorAll<HTMLTextAreaElement>('textarea');
    at(areas, 1).value = '<p>Oswiadczenie</p>';
    change(at(areas, 1));
    expect(ctx.state.get('statement.content.pl_PL')).toBe('<p>Oswiadczenie</p>');
  });
});
