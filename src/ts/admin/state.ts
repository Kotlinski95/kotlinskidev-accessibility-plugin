import { isRecord } from './dom';
import type { SettingsTree } from './types';

export type Listener = () => void;

export interface FormState {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  snapshot: () => SettingsTree;
  load: (tree: SettingsTree) => void;
  isDirty: () => boolean;
  subscribe: (listener: Listener) => () => void;
}

const clone = (tree: SettingsTree): SettingsTree => JSON.parse(JSON.stringify(tree)) as SettingsTree;

export const readPath = (tree: SettingsTree, path: string): unknown => {
  let cursor: unknown = tree;
  for (const segment of path.split('.')) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
};

export const writePath = (tree: SettingsTree, path: string, value: unknown): void => {
  const segments = path.split('.');
  const last = segments.pop();
  if (last === undefined) return;
  let cursor: Record<string, unknown> = tree;
  for (const segment of segments) {
    const next = cursor[segment];
    if (isRecord(next)) {
      cursor = next;
      continue;
    }
    const created: Record<string, unknown> = {};
    cursor[segment] = created;
    cursor = created;
  }
  cursor[last] = value;
};

export const createFormState = (initial: SettingsTree): FormState => {
  let current = clone(initial);
  let saved = JSON.stringify(current);
  const listeners = new Set<Listener>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return {
    get: (path) => readPath(current, path),
    set: (path, value) => {
      writePath(current, path, value);
      notify();
    },
    snapshot: () => clone(current),
    load: (tree) => {
      current = clone(tree);
      saved = JSON.stringify(current);
      notify();
    },
    isDirty: () => JSON.stringify(current) !== saved,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
