import { __, sprintf } from '@wordpress/i18n';
import type { FormContext } from '../context';
import { button, fieldset, h, uid, wrapField } from '../dom';
import { createChecklistField } from '../fields/checklist';
import { createSelectField, enumChoices } from '../fields/select';
import { createTextField } from '../fields/text';
import { createTextListField } from '../fields/text-list';
import { dialogActionLabel, launcherLabel, snippetKindLabel, urlActionLabel } from '../labels';
import { buildSnippets, composeAction, MAX_LABEL_LENGTH } from '../snippets';
import type { SnippetElement, SnippetKind } from '../snippets';
import {
  checkTriggers,
  exceedsSelectorList,
  SELECTOR_LIST_MAX_ITEMS,
  SELECTOR_LIST_MAX_LENGTH,
  selectorIssue,
} from '../trigger-check';
import type { TriggerCheckStatus } from '../trigger-check';

const SNIPPET_KINDS: readonly SnippetKind[] = ['html', 'link', 'shortcode', 'php', 'javascript', 'url'];
const STATIC_ACTIONS: readonly string[] = ['open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show'];
const LEVELS: readonly number[] = [1, 2, 3, 4, 5];

interface ActionChoice {
  value: string;
  label: string;
}

const stringsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const watchWhileConnected = (ctx: FormContext, anchor: HTMLElement, update: () => void): void => {
  let attached = false;
  const unsubscribe = ctx.state.subscribe(() => {
    if (anchor.isConnected) attached = true;
    else if (attached) {
      unsubscribe();
      return;
    }
    update();
  });
  update();
};

export const describeTriggerCheck = (status: TriggerCheckStatus): { kind: 'warning' | 'error' | 'info'; message: string } | null => {
  if (status === 'warning') {
    return {
      kind: 'warning',
      message: __('No accessibility trigger was found on the home page. Visitors can open the panel only with the keyboard shortcut.', 'kotlinskidev-accessibility'),
    };
  }
  if (status === 'error') {
    return {
      kind: 'error',
      message: __('No accessibility trigger was found on the home page, and the keyboard shortcut is off. Visitors cannot open the panel.', 'kotlinskidev-accessibility'),
    };
  }
  if (status === 'unreachable') return { kind: 'info', message: __('The home page could not be checked.', 'kotlinskidev-accessibility') };
  return null;
};

const runCheck = (ctx: FormContext): Promise<TriggerCheckStatus> =>
  checkTriggers({
    launcher: ctx.state.get('widget.launcher'),
    shortcutEnabled: ctx.state.get('shortcut.enabled') === true,
    selectors: stringsOf(ctx.state.get('triggers.selectors')),
    homeUrl: ctx.config.homeUrl,
  }).then((result) => result.status);

const noticeElement = (status: TriggerCheckStatus, dismiss?: () => void): HTMLElement | null => {
  const description = describeTriggerCheck(status);
  if (description === null) return null;
  const notice = h('div', { class: `notice notice-${description.kind === 'info' ? 'info' : description.kind} inline ka11y-notice ka11y-trigger-notice` }, h('p', {}, description.message));
  if (dismiss !== undefined) {
    const close = button(__('Dismiss this notice', 'kotlinskidev-accessibility'), 'button-link ka11y-trigger-notice__dismiss', dismiss);
    notice.append(close);
  }
  return notice;
};

export interface TriggerNotice {
  element: HTMLElement;
  refresh: () => Promise<void>;
}

export const createTriggerNotice = (ctx: FormContext): TriggerNotice => {
  const element = h('div', { class: 'ka11y-trigger-warning', role: 'status', 'aria-live': 'polite' });
  let dismissed: TriggerCheckStatus | null = null;

  const refresh = async (): Promise<void> => {
    const status = await runCheck(ctx);
    if (status === 'unreachable' || status === dismissed) {
      element.replaceChildren();
      return;
    }
    const notice = noticeElement(status, () => {
      dismissed = status;
      element.replaceChildren();
    });
    element.replaceChildren(...(notice === null ? [] : [notice]));
  };

  return { element, refresh };
};

const buildCheckRegion = (ctx: FormContext): HTMLElement => {
  const region = h('div', { class: 'ka11y-trigger-check', role: 'status', 'aria-live': 'polite' });
  void runCheck(ctx).then((status) => {
    const notice = noticeElement(status);
    region.replaceChildren(...(notice === null ? [] : [notice]));
  });
  return region;
};

const buildLauncherFieldset = (ctx: FormContext): HTMLElement => {
  const mountField = h(
    'div',
    { class: 'ka11y-launcher-mount' },
    createTextField(ctx, {
      path: 'widget.mount',
      label: __('Mount selector', 'kotlinskidev-accessibility'),
      placeholder: '#site-footer .accessibility',
      help: __(
        'The launcher moves into the first element matching this selector. If none matches, it falls back to the floating button. Reserve about 48 px of height in the mount to avoid layout shift.',
        'kotlinskidev-accessibility'
      ),
    })
  );
  const root = fieldset(
    __('Launcher', 'kotlinskidev-accessibility'),
    'ka11y-launcher',
    createSelectField(ctx, {
      path: 'widget.launcher',
      label: __('Launcher mode', 'kotlinskidev-accessibility'),
      help: __(
        'Floating keeps the button fixed in the corner. Inside a page element places it in the mount below. With no launcher button the panel opens only from your own triggers or the keyboard shortcut.',
        'kotlinskidev-accessibility'
      ),
      choices: enumChoices(ctx, 'widget.launcher', launcherLabel),
    }),
    mountField
  );
  watchWhileConnected(ctx, root, () => {
    mountField.hidden = ctx.state.get('widget.launcher') !== 'inline';
  });
  return root;
};

const selectorMessage = (selector: string): string | null => {
  const issue = selectorIssue(selector);
  if (issue === 'invalid') return sprintf(__('%s is not a valid selector.', 'kotlinskidev-accessibility'), selector);
  if (issue === 'broad') return sprintf(__('%s is too broad and will not be saved.', 'kotlinskidev-accessibility'), selector);
  if (issue === 'long') return sprintf(__('%s is longer than 200 characters and will not be saved.', 'kotlinskidev-accessibility'), selector);
  return null;
};

const buildSelectorReadout = (ctx: FormContext): HTMLElement => {
  const readout = h('ul', { class: 'ka11y-selector-errors', role: 'status', 'aria-live': 'polite' });
  watchWhileConnected(ctx, readout, () => {
    const selectors = stringsOf(ctx.state.get('triggers.selectors'));
    const messages = selectors.map(selectorMessage).filter((message): message is string => message !== null);
    if (exceedsSelectorList(selectors)) {
      messages.push(
        sprintf(
          __('Only the first selectors that fit in %1$d entries and %2$d characters in total will be saved.', 'kotlinskidev-accessibility'),
          SELECTOR_LIST_MAX_ITEMS,
          SELECTOR_LIST_MAX_LENGTH
        )
      );
    }
    readout.replaceChildren(...messages.map((message) => h('li', { class: 'ka11y-selector-errors__item' }, message)));
  });
  return readout;
};

const buildSelectorsFieldset = (ctx: FormContext): HTMLElement =>
  fieldset(
    __('Custom selectors', 'kotlinskidev-accessibility'),
    'ka11y-selectors',
    createTextListField(ctx, {
      path: 'triggers.selectors',
      label: __('Elements that toggle the panel', 'kotlinskidev-accessibility'),
      placeholder: '.menu-item-a11y > a',
      help: sprintf(
        __('Clicking an element matching one of these CSS selectors opens or closes the panel. Up to %1$d selectors, %2$d characters in total.', 'kotlinskidev-accessibility'),
        SELECTOR_LIST_MAX_ITEMS,
        SELECTOR_LIST_MAX_LENGTH
      ),
    }),
    buildSelectorReadout(ctx)
  );

const buildUrlActionsFieldset = (ctx: FormContext): HTMLElement =>
  fieldset(
    __('URL actions', 'kotlinskidev-accessibility'),
    'ka11y-url-actions',
    h(
      'p',
      { class: 'description' },
      __(
        'Links such as ?ka11y=profile:key or #ka11y/feature:key can apply these actions. URL actions are never saved by themselves and cannot enable features that are turned off. Clear all to disable them.',
        'kotlinskidev-accessibility'
      )
    ),
    createChecklistField(ctx, {
      path: 'triggers.urlActions',
      label: __('Allowed URL actions', 'kotlinskidev-accessibility'),
      choices: (ctx.schema.definitions['triggers.urlActions']?.enum ?? []).map((value) => ({ value, label: urlActionLabel(value) })),
    })
  );

const enabledKeys = (ctx: FormContext, group: 'features' | 'profiles', keys: readonly string[]): string[] =>
  keys.filter((key) => ctx.state.get(`${group}.${key}.enabled`) !== false);

const actionChoices = (ctx: FormContext): ActionChoice[] => {
  const featureLabel = (key: string): string => ctx.config.strings[`features.${key}.label`] ?? key;
  const profileLabel = (key: string): string => ctx.config.strings[`profiles.${key}`] ?? key;
  return [
    ...STATIC_ACTIONS.map((value) => ({ value, label: dialogActionLabel(value) })),
    ...enabledKeys(ctx, 'features', ctx.schema.features).map((key) => ({
      value: `feature:${key}`,
      label: sprintf(__('Feature: %s', 'kotlinskidev-accessibility'), featureLabel(key)),
    })),
    ...enabledKeys(ctx, 'profiles', ctx.schema.profiles).map((key) => ({
      value: `profile:${key}`,
      label: sprintf(__('Profile: %s', 'kotlinskidev-accessibility'), profileLabel(key)),
    })),
  ];
};

const fillSelect = (select: HTMLSelectElement, choices: readonly ActionChoice[]): void => {
  const previous = select.value;
  select.replaceChildren(...choices.map((choice) => h('option', { value: choice.value }, choice.label)));
  select.value = choices.some((choice) => choice.value === previous) ? previous : (choices[0]?.value ?? '');
};

export const copyText = async (field: HTMLTextAreaElement): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(field.value);
    return true;
  } catch {
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
};

const buildPreview = (action: string, label: string, element: SnippetElement, classes: readonly string[]): HTMLElement => {
  const node = document.createElement(element === 'link' ? 'a' : 'button');
  if (element === 'link') node.setAttribute('role', 'button');
  else node.setAttribute('type', 'button');
  node.setAttribute('class', ['wp-element-button', ...classes].join(' '));
  node.setAttribute('data-ka11y', action);
  node.textContent = label;
  node.addEventListener('click', (event) => event.preventDefault());
  return node;
};

const buildSnippetGenerator = (ctx: FormContext): HTMLElement => {
  const actionSelect = h('select', { class: 'ka11y-select' });
  const levelSelect = h('select', { class: 'ka11y-select' });
  const labelInput = h('input', { type: 'text', class: 'regular-text', maxlength: MAX_LABEL_LENGTH });
  const elementSelect = h('select', { class: 'ka11y-select' });
  const classInput = h('input', { type: 'text', class: 'regular-text' });
  const status = h('p', { class: 'ka11y-snippets__status', role: 'status', 'aria-live': 'polite' });
  const preview = h('div', { class: 'ka11y-snippets__preview' });
  const levelField = wrapField(levelSelect, { path: '', label: __('Level', 'kotlinskidev-accessibility') });

  levelSelect.append(h('option', { value: '' }, __('Toggle on and off', 'kotlinskidev-accessibility')));
  for (const level of LEVELS) levelSelect.append(h('option', { value: String(level) }, String(level)));
  elementSelect.append(h('option', { value: 'button' }, __('Button', 'kotlinskidev-accessibility')), h('option', { value: 'link' }, __('Link', 'kotlinskidev-accessibility')));

  const outputs = new Map<SnippetKind, { row: HTMLElement; field: HTMLTextAreaElement }>();
  const rows = SNIPPET_KINDS.map((kind) => {
    const id = uid('ka11y-snippet');
    const field = h('textarea', { id, class: 'large-text code ka11y-snippets__output', readonly: true, rows: 2 });
    const copy = button(__('Copy', 'kotlinskidev-accessibility'), 'button ka11y-snippets__copy', () => {
      void copyText(field).then((copied) => {
        status.textContent = copied
          ? sprintf(__('%s copied.', 'kotlinskidev-accessibility'), snippetKindLabel(kind))
          : sprintf(__('%s could not be copied.', 'kotlinskidev-accessibility'), snippetKindLabel(kind));
      });
    });
    copy.setAttribute('aria-label', sprintf(__('Copy %s', 'kotlinskidev-accessibility'), snippetKindLabel(kind)));
    const row = h('div', { class: 'ka11y-snippets__row' }, h('label', { class: 'ka11y-field__label', for: id }, snippetKindLabel(kind)), field, copy);
    outputs.set(kind, { row, field });
    return row;
  });

  const currentAction = (): string => {
    const base = actionSelect.value;
    const level = levelSelect.value === '' || !base.startsWith('feature:') ? null : Number(levelSelect.value);
    return composeAction(base, level);
  };

  const defaultLabel = (): string => actionChoices(ctx).find((choice) => choice.value === actionSelect.value)?.label ?? __('Accessibility', 'kotlinskidev-accessibility');

  const render = (): void => {
    levelField.hidden = !actionSelect.value.startsWith('feature:');
    const action = currentAction();
    const label = labelInput.value.trim() === '' ? defaultLabel() : labelInput.value;
    const element: SnippetElement = elementSelect.value === 'link' ? 'link' : 'button';
    const snippets = buildSnippets({
      action,
      label,
      element,
      extraClass: classInput.value,
      homeUrl: ctx.config.homeUrl,
      urlActions: stringsOf(ctx.state.get('triggers.urlActions')),
    });
    for (const kind of SNIPPET_KINDS) {
      const output = outputs.get(kind);
      const value = snippets[kind];
      if (output === undefined) continue;
      output.row.hidden = value === null;
      output.field.value = value ?? '';
    }
    const classes = classInput.value
      .split(/\s+/)
      .map((token) => token.replace(/[^A-Za-z0-9_-]/g, ''))
      .filter((token) => token !== '');
    preview.replaceChildren(buildPreview(action, label.trim().slice(0, MAX_LABEL_LENGTH), element, classes));
  };

  for (const control of [actionSelect, levelSelect, elementSelect]) control.addEventListener('change', render);
  for (const control of [labelInput, classInput]) control.addEventListener('input', render);

  const root = fieldset(
    __('Snippet generator', 'kotlinskidev-accessibility'),
    'ka11y-snippets',
    h(
      'p',
      { class: 'description' },
      __('Build a trigger for any button, link, template or menu item. Copy the output that fits where you place it.', 'kotlinskidev-accessibility')
    ),
    wrapField(actionSelect, { path: '', label: __('Action', 'kotlinskidev-accessibility') }),
    levelField,
    wrapField(labelInput, { path: '', label: __('Label', 'kotlinskidev-accessibility'), help: __('Leave empty to use the default label for the action.', 'kotlinskidev-accessibility') }),
    wrapField(elementSelect, { path: '', label: __('Element', 'kotlinskidev-accessibility') }),
    wrapField(classInput, { path: '', label: __('Extra class', 'kotlinskidev-accessibility'), help: __('Space separated class names, for example button is-style-outline.', 'kotlinskidev-accessibility') }),
    h('div', { class: 'ka11y-snippets__preview-wrap' }, h('p', { class: 'ka11y-field__label' }, __('Preview', 'kotlinskidev-accessibility')), preview),
    ...rows,
    status
  );

  fillSelect(actionSelect, actionChoices(ctx));
  render();
  watchWhileConnected(ctx, root, () => {
    fillSelect(actionSelect, actionChoices(ctx));
    render();
  });
  return root;
};

export const buildTriggersPanel = (ctx: FormContext): HTMLElement =>
  h(
    'div',
    { class: 'ka11y-panel ka11y-panel--triggers' },
    buildCheckRegion(ctx),
    buildLauncherFieldset(ctx),
    buildSelectorsFieldset(ctx),
    buildUrlActionsFieldset(ctx),
    buildSnippetGenerator(ctx)
  );
