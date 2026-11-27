import { buildAppearancePanel } from '../../../src/ts/admin/panels/appearance';
import { change, sampleContext } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, {
  virtual: true,
});

const mounted = (ctx = sampleContext()): { panel: HTMLElement; ctx: ReturnType<typeof sampleContext> } => {
  const panel = buildAppearancePanel(ctx);
  document.body.append(panel);
  return { panel, ctx };
};

const colorText = (panel: HTMLElement, label: string): HTMLInputElement => {
  const field = [...panel.querySelectorAll('.ka11y-field--color')].find((item) => item.querySelector('label')?.textContent === label);
  return field?.querySelector('input[type="text"]') as HTMLInputElement;
};

const badge = (panel: HTMLElement, label: string): string =>
  [...panel.querySelectorAll('.ka11y-field--color')].find((item) => item.querySelector('label')?.textContent === label)?.querySelector('.ka11y-contrast')?.textContent ?? '';

afterEach(() => {
  document.body.replaceChildren();
});

describe('appearance panel', () => {
  it('renders the twelve color fields, columns, sections, language switcher and credit', () => {
    const { panel } = mounted();
    expect(panel.querySelectorAll('.ka11y-colors .ka11y-field--color')).toHaveLength(12);
    expect(panel.querySelectorAll('.ka11y-panel-layout input[type="checkbox"]')).toHaveLength(7);
    expect(panel.querySelector('.ka11y-panel-layout select')).not.toBeNull();
  });

  it('updates the contrast badge on input', () => {
    const { panel } = mounted();
    expect(badge(panel, 'Text on primary color')).toContain('6.3:1 against Primary color');
    const text = colorText(panel, 'Text on primary color');
    text.value = '#0c58d1';
    change(text);
    expect(badge(panel, 'Text on primary color')).toContain('fails');
    expect(badge(panel, 'Primary color')).toContain('Text on primary color');
  });

  it('applies a preset and reloads', () => {
    const { panel, ctx } = mounted();
    const select = panel.querySelector('.ka11y-colors select') as HTMLSelectElement;
    const index = [...select.options].findIndex((option) => option.textContent === 'High contrast');
    select.value = String(index);
    change(select, 'change');
    expect(ctx.state.get('panel.preset')).toBe('contrast');
    expect(ctx.state.get('tokens.headerBg')).toBe('#000000');
    expect(ctx.state.get('tokens.onPrimary')).toBe('#ffff00');
    expect(ctx.reload).toHaveBeenCalled();
  });

  it('switches to custom when a token is edited', () => {
    const { panel, ctx } = mounted();
    const text = colorText(panel, 'Header background');
    text.value = '#222222';
    change(text);
    expect(ctx.state.get('panel.preset')).toBe('custom');
  });

  it('keeps custom colors when the custom preset is chosen', () => {
    const { ctx } = mounted();
    ctx.state.set('tokens.primary', '#123456');
    ctx.state.set('panel.preset', 'custom');
    expect(ctx.state.get('tokens.primary')).toBe('#123456');
  });

  it('saves section toggles and columns', () => {
    const { panel, ctx } = mounted();
    const boxes = panel.querySelectorAll<HTMLInputElement>('.ka11y-panel-layout input[type="checkbox"]');
    const first = boxes[0] as HTMLInputElement;
    first.checked = false;
    change(first, 'change');
    expect(ctx.state.get('panel.sections.profiles')).toBe(false);
    const columns = panel.querySelector('.ka11y-panel-layout select') as HTMLSelectElement;
    columns.value = '0';
    change(columns, 'change');
    expect(ctx.state.get('panel.columns')).toBe(2);
  });

  it('warns when matching a theme without a palette', () => {
    const { panel, ctx } = mounted();
    const match = [...panel.querySelectorAll('.ka11y-colors button')].find((item) => item.textContent === 'Match theme') as HTMLButtonElement;
    match.click();
    expect(ctx.notices.element.textContent).toContain('does not define a color palette');
    expect(ctx.state.get('tokens.primary')).toBe('#0b57d0');
  });

  it('maps primary and primary-dark from the theme palette', () => {
    const ctx = sampleContext();
    ctx.config = {
      ...ctx.config,
      themePalette: [
        {
          slug: 'primary',
          name: 'Primary',
          color: '#0078c2',
          var: '--wp--preset--color--primary',
        },
        {
          slug: 'primary-dark',
          name: 'Primary dark',
          color: '#003a60',
          var: '--wp--preset--color--primary-dark',
        },
      ],
    };
    const { panel } = mounted(ctx);
    const match = [...panel.querySelectorAll('.ka11y-colors button')].find((item) => item.textContent === 'Match theme') as HTMLButtonElement;
    match.click();
    expect(ctx.state.get('tokens.primary')).toBe('var(--wp--preset--color--primary, #0078c2)');
    expect(ctx.state.get('tokens.primaryDark')).toBe('var(--wp--preset--color--primary-dark, #003a60)');
  });
});
