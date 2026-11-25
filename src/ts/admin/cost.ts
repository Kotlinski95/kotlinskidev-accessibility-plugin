import { readPath } from './state';
import type { CostData, ManifestEntry, SettingsTree } from './types';

export interface CostEstimate {
  onLoad: number;
  onUse: number;
}

const CHUNKS: readonly string[] = ['kernel', 'panel', 'content', 'color', 'orientation'];

const gzipOf = (group: Record<string, ManifestEntry> | undefined, name: string): number => group?.[name]?.gzip ?? 0;

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

export const estimateCost = (cost: CostData, settings: SettingsTree): CostEstimate => {
  const { scripts, styles, inline } = cost.manifest;
  const strategy = readPath(settings, 'performance.strategy');
  const pageCss = readPath(settings, 'performance.pageCss');
  const pageStyle = gzipOf(styles, 'page');

  const always = sum([cost.config, gzipOf(inline, 'bootstrap'), gzipOf(scripts, 'loader'), gzipOf(styles, 'launcher')]);
  const demand = sum([...CHUNKS.map((name) => gzipOf(scripts, name)), cost.panelData]);
  const linkedStyle = pageCss === 'lazy' ? 0 : pageStyle;
  const lazyStyle = pageCss === 'lazy' ? pageStyle : 0;
  const deferred = strategy === 'interaction';

  return {
    onLoad: always + linkedStyle + (deferred ? 0 : demand + lazyStyle),
    onUse: deferred ? demand + lazyStyle : 0,
  };
};

export const formatBytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
