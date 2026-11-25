import { PATH_ATTRIBUTE } from './dom';
import type { SchemaPayload } from './types';

export const isCustomerMode = (schema: SchemaPayload): boolean => schema.access === 'customer';

export const isEditablePath = (schema: SchemaPayload, path: string): boolean => !isCustomerMode(schema) || (schema.editable ?? []).some((prefix) => path === prefix || path.startsWith(`${prefix}.`));

export const pruneToEditable = (panel: HTMLElement, schema: SchemaPayload): boolean => {
  panel.querySelectorAll<HTMLElement>(`[${PATH_ATTRIBUTE}]`).forEach((element) => {
    if (!isEditablePath(schema, element.getAttribute(PATH_ATTRIBUTE) ?? '')) element.remove();
  });
  panel.querySelectorAll('fieldset').forEach((group) => {
    if (group.querySelector(`[${PATH_ATTRIBUTE}]`) === null) group.remove();
  });
  return panel.querySelector(`[${PATH_ATTRIBUTE}]`) !== null;
};
