import { estimateCost, formatBytes } from '../../../src/ts/admin/cost';
import { sampleCost, sampleDefaults } from './helpers';
import type { SettingsTree } from '../../../src/ts/admin/types';

const settings = (performance: Record<string, unknown>): SettingsTree => ({ ...sampleDefaults(), performance });

describe('estimateCost', () => {
  it('defers the panel chunks to first use under interaction loading', () => {
    const estimate = estimateCost(sampleCost(), settings({ strategy: 'interaction', pageCss: 'lazy' }));
    expect(estimate.onLoad).toBe(800 + 300 + 1000 + 400);
    expect(estimate.onUse).toBe(2000 + 3000 + 1000 + 500 + 200 + 2500 + 1500);
  });

  it('moves everything to page load under eager loading with linked styles', () => {
    const estimate = estimateCost(sampleCost(), settings({ strategy: 'eager', pageCss: 'linked' }));
    expect(estimate.onUse).toBe(0);
    expect(estimate.onLoad).toBe(800 + 300 + 1000 + 400 + 1500 + 2000 + 3000 + 1000 + 500 + 200 + 2500);
  });

  it('counts linked styles on load but chunks on use under interaction loading', () => {
    const estimate = estimateCost(sampleCost(), settings({ strategy: 'interaction', pageCss: 'inline' }));
    expect(estimate.onLoad).toBe(800 + 300 + 1000 + 400 + 1500);
    expect(estimate.onUse).toBe(2000 + 3000 + 1000 + 500 + 200 + 2500);
  });

  it('treats missing manifest entries as zero', () => {
    const cost = { ...sampleCost(), manifest: { scripts: {}, styles: {}, inline: {} } };
    expect(estimateCost(cost, settings({ strategy: 'interaction', pageCss: 'lazy' }))).toEqual({ onLoad: 800, onUse: 2500 });
  });
});

describe('formatBytes', () => {
  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(0)).toBe('0.0 KB');
  });
});
