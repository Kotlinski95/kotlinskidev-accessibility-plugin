import { buildVisibilityPanel } from '../../../src/ts/admin/panels/visibility';
import { change, sampleContext, sampleDefaults } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const fieldsetOf = (panel: HTMLElement, legend: string): HTMLFieldSetElement =>
  [...panel.querySelectorAll('fieldset')].find((item) => item.querySelector('legend')?.textContent === legend) as HTMLFieldSetElement;

const MODES = ['everywhere', 'only_on', 'except_on'];

const chooseMode = (panel: HTMLElement, mode: string): void => {
  const select = panel.querySelector('.ka11y-field select') as HTMLSelectElement;
  select.value = String(MODES.indexOf(mode));
  change(select, 'change');
};

describe('visibility panel mode swap', () => {
  it('hides both rule fieldsets in everywhere mode', () => {
    const panel = buildVisibilityPanel(sampleContext());
    expect(fieldsetOf(panel, 'Only on').hidden).toBe(true);
    expect(fieldsetOf(panel, 'Except on').hidden).toBe(true);
  });

  it('lists the visibility modes as choices', () => {
    const panel = buildVisibilityPanel(sampleContext());
    const select = panel.querySelector('.ka11y-field select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(fieldsetOf(panel, 'Only on').querySelectorAll('.ka11y-field--list')).toHaveLength(5);
    expect(fieldsetOf(panel, 'Except on').querySelectorAll('.ka11y-field--list')).toHaveLength(5);
  });

  it('shows the include lists only in only_on mode', () => {
    const ctx = sampleContext();
    const panel = buildVisibilityPanel(ctx);
    chooseMode(panel, 'only_on');
    expect(ctx.state.get('visibility.mode')).toBe('only_on');
    expect(fieldsetOf(panel, 'Only on').hidden).toBe(false);
    expect(fieldsetOf(panel, 'Except on').hidden).toBe(true);
  });

  it('shows the exclude lists only in except_on mode', () => {
    const ctx = sampleContext();
    const panel = buildVisibilityPanel(ctx);
    chooseMode(panel, 'except_on');
    expect(fieldsetOf(panel, 'Only on').hidden).toBe(true);
    expect(fieldsetOf(panel, 'Except on').hidden).toBe(false);
  });

  it('starts with the saved mode', () => {
    const settings = sampleDefaults();
    (settings.visibility as Record<string, unknown>).mode = 'only_on';
    const panel = buildVisibilityPanel(sampleContext(settings));
    expect(fieldsetOf(panel, 'Only on').hidden).toBe(false);
  });

  it('keeps both lists untouched when the mode changes', () => {
    const settings = sampleDefaults();
    const visibility = settings.visibility as Record<string, unknown>;
    visibility.includePostIds = [4, 9];
    visibility.includeTemplates = ['front-page'];
    visibility.excludeRoles = ['__guest'];
    visibility.excludeTemplates = ['single'];
    const ctx = sampleContext(settings);
    const panel = buildVisibilityPanel(ctx);
    for (const mode of ['only_on', 'except_on', 'everywhere', 'only_on']) chooseMode(panel, mode);
    expect(ctx.state.get('visibility.includePostIds')).toEqual([4, 9]);
    expect(ctx.state.get('visibility.includeTemplates')).toEqual(['front-page']);
    expect(ctx.state.get('visibility.excludeRoles')).toEqual(['__guest']);
    expect(ctx.state.get('visibility.excludeTemplates')).toEqual(['single']);
  });
});
