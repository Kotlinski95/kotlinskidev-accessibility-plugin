import type { FeatureLevel } from '../../shared/types';
import { createElement } from '../dom';
import { FEATURE_LEVEL_LABELS, levelCountOf } from '../feature-groups';
import { isLevelActive } from '../feature-utils';
import type { Profiles } from '../profiles';
import type { Control, PanelContext } from './context';
import { iconChildren } from './icons';

interface TileSpec {
  attribute: 'data-feature' | 'data-profile';
  key: string;
  label: string;
  levels: number;
  description: string | null;
  onActivate(): void;
}

interface TileView {
  nodes: HTMLElement[];
  set(pressed: boolean, level: number, stateText: string): void;
}

export const numericLevel = (level: FeatureLevel | undefined): number => {
  if (typeof level === 'number') return level;
  return level === true ? 1 : 0;
};

export const nextLevel = (key: string, current: FeatureLevel | undefined): FeatureLevel => {
  const count = levelCountOf(key);
  if (count === 1) return !isLevelActive(current);
  const value = numericLevel(current);
  return value >= count ? 0 : value + 1;
};

export const levelLabel = (ctx: PanelContext, key: string, level: FeatureLevel | undefined): string => {
  if (!isLevelActive(level)) return ctx.t('levelOff');
  const labels = FEATURE_LEVEL_LABELS[key];
  return ctx.t(typeof level === 'number' && labels ? (labels[level - 1] ?? 'levelOn') : 'levelOn');
};

const buildTile = (ctx: PanelContext, spec: TileSpec): TileView => {
  const { doc, key } = { doc: ctx.doc, key: spec.key };
  const descriptionId = `ka11y-desc-${key}`;
  const stateId = `ka11y-state-${key}`;
  const multi = spec.levels > 1;
  const describedBy = [spec.description === null ? '' : descriptionId, multi ? stateId : ''].filter((id) => id !== '').join(' ');
  const dots = Array.from({ length: multi ? spec.levels : 0 }, () => createElement(doc, 'i'));
  const stateNode = createElement(doc, 'span', { id: stateId, hidden: true });
  const button = createElement(
    doc,
    'button',
    { type: 'button', class: 'ka11y-tile', 'aria-pressed': 'false', 'aria-describedby': describedBy || undefined, [spec.attribute]: key },
    [
      createElement(doc, 'span', { class: 'ka11y-tile__icon', 'aria-hidden': 'true' }, iconChildren(ctx.icon(key))),
      createElement(doc, 'span', { class: 'ka11y-tile__label' }, [spec.label]),
      ...(multi ? [createElement(doc, 'span', { class: 'ka11y-dots', 'aria-hidden': 'true' }, dots)] : []),
      createElement(doc, 'span', { class: 'ka11y-tile__check', 'aria-hidden': 'true' }, iconChildren(ctx.icon('check'))),
    ]
  );
  ctx.listen(button, 'click', spec.onActivate);
  const nodes: HTMLElement[] = [button];
  if (spec.description !== null) nodes.push(createElement(doc, 'span', { id: descriptionId, hidden: true }, [spec.description]));
  if (multi) nodes.push(stateNode);
  const set = (pressed: boolean, level: number, stateText: string): void => {
    button.setAttribute('aria-pressed', String(pressed));
    dots.forEach((dot, index) => dot.toggleAttribute('data-on', index < level));
    stateNode.textContent = stateText;
  };
  return { nodes, set };
};

export const buildFeatureTile = (ctx: PanelContext, key: string): Control => {
  const view = buildTile(ctx, {
    attribute: 'data-feature',
    key,
    label: ctx.t(`features.${key}.label`),
    levels: levelCountOf(key),
    description: ctx.t(`features.${key}.description`),
    onActivate: () => ctx.store.setLevel(key, nextLevel(key, ctx.store.getState().levels[key])),
  });
  return {
    nodes: view.nodes,
    update: (state) => {
      const level = state.levels[key];
      view.set(isLevelActive(level), numericLevel(level), levelLabel(ctx, key, level));
    },
  };
};

export const buildProfileTile = (ctx: PanelContext, profiles: Profiles, key: string): Control => {
  const view = buildTile(ctx, {
    attribute: 'data-profile',
    key,
    label: ctx.t(`profiles.${key}`),
    levels: 1,
    description: null,
    onActivate: () => profiles.toggle(key),
  });
  return { nodes: view.nodes, update: () => view.set(profiles.isActive(key), 0, '') };
};
