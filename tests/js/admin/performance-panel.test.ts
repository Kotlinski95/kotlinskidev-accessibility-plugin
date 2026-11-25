import { buildPerformancePanel } from '../../../src/ts/admin/panels/performance';
import { change, sampleContext, samplePresets } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

const PRESETS = ['recommended', 'compatibility', 'custom'];
const KEYS = ['strategy', 'position', 'fetchPriority', 'prefetch', 'pageCss', 'deviceSkip', 'optOut'];

const presetSelect = (panel: HTMLElement): HTMLSelectElement => panel.querySelector('.ka11y-preset select') as HTMLSelectElement;

const pick = (select: HTMLSelectElement, index: number): void => {
  select.value = String(index);
  change(select, 'change');
};

const legends = (panel: HTMLElement): string[] => [...panel.querySelectorAll('legend')].map((item) => item.textContent ?? '');

describe('performance panel', () => {
  it('renders the six fieldsets', () => {
    expect(legends(buildPerformancePanel(sampleContext()))).toEqual(
      expect.arrayContaining(['Preset', 'Loading', 'Styles', 'Devices', 'Optimizers', 'Exclude the widget scripts from', 'Cost per page'])
    );
  });

  it('writes the compatibility row into the state and reloads', () => {
    const ctx = sampleContext();
    const panel = buildPerformancePanel(ctx);
    pick(presetSelect(panel), PRESETS.indexOf('compatibility'));
    const row = samplePresets().compatibility as Record<string, unknown>;
    for (const key of KEYS) expect(ctx.state.get(`performance.${key}`)).toEqual(row[key]);
    expect(ctx.state.get('performance.preset')).toBe('compatibility');
    expect(ctx.reload).toHaveBeenCalledTimes(1);
  });

  it('flips to custom when a field leaves the preset row', () => {
    const ctx = sampleContext();
    buildPerformancePanel(ctx);
    ctx.state.set('performance.strategy', 'eager');
    expect(ctx.state.get('performance.preset')).toBe('custom');
    expect(ctx.state.get('performance.strategy')).toBe('eager');
    expect(ctx.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps custom values when picking custom', () => {
    const ctx = sampleContext();
    const panel = buildPerformancePanel(ctx);
    pick(presetSelect(panel), PRESETS.indexOf('custom'));
    expect(ctx.state.get('performance.strategy')).toBe('interaction');
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  it('watches each state once across rebuilds', () => {
    const ctx = sampleContext();
    buildPerformancePanel(ctx);
    buildPerformancePanel(ctx);
    ctx.state.set('performance.prefetch', 'idle');
    expect(ctx.reload).toHaveBeenCalledTimes(1);
  });

  it('updates the cost readout when settings change', () => {
    const ctx = sampleContext();
    const panel = buildPerformancePanel(ctx);
    document.body.append(panel);
    const lines = (): string => panel.querySelector('.ka11y-cost')?.textContent ?? '';
    const before = lines();
    pick(presetSelect(panel), PRESETS.indexOf('compatibility'));
    expect(lines()).not.toBe(before);
    panel.remove();
  });
});
