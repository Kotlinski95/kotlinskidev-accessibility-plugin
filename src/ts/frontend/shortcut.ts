import type { ShortcutConfig } from '../shared/types';

export interface ParsedCombo {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  key: string;
  code: string;
}

export interface ComboEvent {
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  key: string;
  code: string;
}

export interface ShortcutOptions {
  config: ShortcutConfig;
  onToggle(): void;
  doc?: Document;
}

const MODIFIERS: Readonly<Record<string, 'alt' | 'shift' | 'ctrl' | 'meta'>> = {
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
};

const codeFor = (key: string): string => {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  return key;
};

export const parseCombo = (combo: string): ParsedCombo | null => {
  const parsed: ParsedCombo = { alt: false, shift: false, ctrl: false, meta: false, key: '', code: '' };
  const parts = combo.split('+').map((part) => part.trim().toLowerCase());
  for (const part of parts) {
    if (part === '') return null;
    const modifier = MODIFIERS[part];
    if (modifier) {
      parsed[modifier] = true;
      continue;
    }
    if (parsed.key !== '') return null;
    parsed.key = part;
    parsed.code = codeFor(part);
  }
  return parsed.key === '' ? null : parsed;
};

export const matchesCombo = (combo: ParsedCombo, event: ComboEvent): boolean => {
  if (
    combo.alt !== event.altKey ||
    combo.shift !== event.shiftKey ||
    combo.ctrl !== event.ctrlKey ||
    combo.meta !== event.metaKey
  ) {
    return false;
  }
  return event.code.toLowerCase() === combo.code.toLowerCase() || event.key.toLowerCase() === combo.key;
};

export const bindShortcut = ({ config, onToggle, doc = document }: ShortcutOptions): (() => void) => {
  const combo = config.enabled ? parseCombo(config.combo) : null;
  if (!combo) return () => undefined;

  const onKeydown = (event: KeyboardEvent): void => {
    if (!matchesCombo(combo, event)) return;
    event.preventDefault();
    onToggle();
  };

  doc.addEventListener('keydown', onKeydown);
  return () => doc.removeEventListener('keydown', onKeydown);
};
