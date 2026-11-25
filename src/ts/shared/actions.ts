export type DialogActionName = 'open' | 'close' | 'toggle';

export type ActionName = DialogActionName | 'reset' | 'feature' | 'profile' | 'statement' | 'hide' | 'show' | 'trigger';

export interface ParsedAction {
  name: ActionName;
  key: string | null;
  level: number | null;
}

export const ACTION_PATTERN = /^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$/;

const LEVEL_PATTERN = /^(0|[1-9][0-9]?)$/;

const BARE_ACTION_PATTERN = /^(open|close|toggle|reset|statement|hide|show|trigger)$/;

const DIALOG_ACTION_PATTERN = /^(open|close|toggle)$/;

export const parseAction = (action: string): ParsedAction | null => {
  if (!ACTION_PATTERN.test(action)) return null;
  const [name, key, level, ...rest] = action.split(':') as [string, string?, string?];
  if (rest.length > 0) return null;
  if (BARE_ACTION_PATTERN.test(name)) {
    return key === undefined ? { name: name as ActionName, key: null, level: null } : null;
  }
  if (key === undefined) return null;
  if (name === 'profile') return level === undefined ? { name, key, level: null } : null;
  if (name !== 'feature') return null;
  if (level === undefined) return { name, key, level: null };
  return LEVEL_PATTERN.test(level) ? { name, key, level: Number(level) } : null;
};

export const isDialogAction = (name: ActionName): name is DialogActionName => DIALOG_ACTION_PATTERN.test(name);
