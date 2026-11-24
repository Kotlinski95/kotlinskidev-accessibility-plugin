import type { FieldContext } from '../context';
import { fieldset, h } from '../dom';
import { createNumberField } from './number';
import { createSelectField } from './select';
import type { Choice } from './select';
import { createToggleField } from './toggle';

export interface MatrixColumn {
  basePath: string;
  label: string;
  kind: 'select' | 'number' | 'toggle';
  choices?: readonly Choice[];
}

export interface DeviceMatrixOptions {
  label: string;
  deviceHeader: string;
  devices: readonly string[];
  deviceLabel: (device: string) => string;
  columns: readonly MatrixColumn[];
}

const createCell = (ctx: FieldContext, column: MatrixColumn, device: string, label: string): HTMLElement => {
  const options = { path: `${column.basePath}.${device}`, label, bare: true };
  if (column.kind === 'select') return createSelectField(ctx, { ...options, choices: column.choices ?? [] });
  if (column.kind === 'number') return createNumberField(ctx, options);
  return createToggleField(ctx, options);
};

export const createDeviceMatrixField = (ctx: FieldContext, options: DeviceMatrixOptions): HTMLElement => {
  const head = h(
    'tr',
    {},
    h('th', { scope: 'col' }, options.deviceHeader),
    ...options.columns.map((column) => h('th', { scope: 'col' }, column.label))
  );
  const rows = options.devices.map((device) =>
    h(
      'tr',
      {},
      h('th', { scope: 'row' }, options.deviceLabel(device)),
      ...options.columns.map((column) =>
        h('td', {}, createCell(ctx, column, device, `${column.label}: ${options.deviceLabel(device)}`))
      )
    )
  );

  return fieldset(
    options.label,
    'ka11y-matrix',
    h('div', { class: 'ka11y-table-wrap' }, h('table', { class: 'widefat striped ka11y-matrix__table' }, h('thead', {}, head), h('tbody', {}, ...rows)))
  );
};
