import { __, sprintf } from '@wordpress/i18n';
import type { Fetcher } from '../api';
import type { FormContext } from '../context';
import { button, errorMessage, h } from '../dom';
import { createToggleField } from '../fields/toggle';
import { createUpdatesApi, globalFetcher, isSameOriginUrl } from '../updates';
import type { ChannelState, ReleaseOption, UpdateChannel, UpdatesApi } from '../updates';

export const NETWORK_LOCKS_PATH = 'locked';

const parseLockedPaths = (text: string): string[] => [...new Set(text.split(/[\s,]+/).filter((line) => line !== ''))].sort();

const unknownLockPaths = (paths: readonly string[], known: ReadonlySet<string>): string[] =>
  paths.filter((path) => path === 'schemaVersion' || !known.has(path));

const buildNetworkLocksCard = (ctx: FormContext): HTMLElement => {
  const known: ReadonlySet<string> = new Set(Object.keys(ctx.schema.definitions));
  const current = ctx.state.get(NETWORK_LOCKS_PATH);
  const initial = Array.isArray(current) ? current.filter((path): path is string => typeof path === 'string') : [];
  const textarea = h('textarea', { id: 'ka11y-network-locks', class: 'large-text code', rows: 6, spellcheck: false });
  const help = h(
    'p',
    { class: 'description', id: 'ka11y-network-locks-help' },
    __('One setting path per line, for example storage.mode. Each listed setting is fixed to the value set here on every site and cannot be changed by site administrators.', 'kotlinskidev-accessibility')
  );
  const error = h('p', { class: 'description ka11y-locks-error', id: 'ka11y-network-locks-error', role: 'alert', hidden: true });

  textarea.value = initial.join('\n');
  textarea.setAttribute('aria-describedby', `${help.id} ${error.id}`);

  textarea.addEventListener('change', () => {
    const paths = parseLockedPaths(textarea.value);
    const unknown = unknownLockPaths(paths, known);
    error.hidden = unknown.length === 0;
    error.textContent = unknown.length === 0 ? '' : sprintf(__('These paths are not lockable settings: %s.', 'kotlinskidev-accessibility'), unknown.join(', '));
    textarea.toggleAttribute('aria-invalid', unknown.length > 0);
    if (unknown.length === 0) ctx.state.set(NETWORK_LOCKS_PATH, paths);
  });

  return h(
    'section',
    { class: 'ka11y-card ka11y-card--network-locks' },
    h('h3', { class: 'ka11y-subheading' }, __('Locked on all sites', 'kotlinskidev-accessibility')),
    h('label', { class: 'ka11y-field__label', for: textarea.id }, __('Locked settings', 'kotlinskidev-accessibility')),
    textarea,
    help,
    error
  );
};

const buildUninstallCard = (ctx: FormContext): HTMLElement =>
  h(
    'section',
    { class: 'ka11y-card' },
    h('h3', { class: 'ka11y-subheading' }, __('Uninstall', 'kotlinskidev-accessibility')),
    h(
      'p',
      { class: 'description' },
      __('Choose what happens to your settings when the plugin is deleted from the Plugins screen.', 'kotlinskidev-accessibility')
    ),
    createToggleField(ctx, {
      path: 'maintenance.keepDataOnUninstall',
      label: __('Keep my settings when the plugin is deleted', 'kotlinskidev-accessibility'),
      help: __('When off, deleting the plugin also deletes its settings.', 'kotlinskidev-accessibility'),
    })
  );

const channelOptions = (selected: UpdateChannel): HTMLOptionElement[] => [
  h('option', { value: 'stable', selected: selected === 'stable' }, __('Stable', 'kotlinskidev-accessibility')),
  h('option', { value: 'beta', selected: selected === 'beta' }, __('Beta (includes pre-releases)', 'kotlinskidev-accessibility')),
];

const releaseItem = (release: ReleaseOption, origin: string): HTMLElement | null => {
  if (!isSameOriginUrl(release.url, origin)) return null;
  const label = release.prerelease
    ? sprintf(__('Roll back to %s (pre-release)', 'kotlinskidev-accessibility'), release.version)
    : sprintf(__('Roll back to %s', 'kotlinskidev-accessibility'), release.version);
  return h('li', {}, h('a', { href: release.url }, label));
};

const renderReleases = (list: HTMLElement, releases: ReleaseOption[]): void => {
  const items = releases.map((release) => releaseItem(release, window.location.origin)).filter((item): item is HTMLElement => item !== null);
  list.replaceChildren(
    ...(items.length > 0 ? items : [h('li', {}, __('No older versions are available for rollback.', 'kotlinskidev-accessibility'))])
  );
};

const buildUpdatesCard = (ctx: FormContext, api: UpdatesApi): HTMLElement => {
  const card = h('section', { class: 'ka11y-card ka11y-card--updates', hidden: true });
  const select = h('select', { id: 'ka11y-update-channel', class: 'ka11y-select', disabled: true }, ...channelOptions('stable'));
  const help = h('p', { class: 'description', id: 'ka11y-update-channel-help' });
  const list = h('ul', { class: 'ka11y-rollback-list', 'aria-live': 'polite' });
  const rollbackHelp = h(
    'p',
    { class: 'description' },
    __('Roll back installs an older release after checking its SHA-256 checksum. Your settings are backed up first and stay.', 'kotlinskidev-accessibility')
  );

  select.setAttribute('aria-describedby', help.id);

  const apply = (state: ChannelState): void => {
    select.replaceChildren(...channelOptions(state.channel));
    select.disabled = state.locked || !state.updaterEnabled;
    help.textContent = !state.updaterEnabled
      ? __('Updates are turned off by site configuration.', 'kotlinskidev-accessibility')
      : state.locked
        ? __('Locked by site configuration.', 'kotlinskidev-accessibility')
        : __('Beta releases are tested but may change. Switching back to Stable waits for the next stable release.', 'kotlinskidev-accessibility');
    rollbackHelp.hidden = !state.updaterEnabled;
    checkButton.hidden = !state.updaterEnabled;
    card.hidden = false;
  };

  const checkButton = button(__('Show older versions', 'kotlinskidev-accessibility'), 'button', () => {
    checkButton.disabled = true;
    api
      .getReleases(true)
      .then((releases) => renderReleases(list, releases))
      .catch((error: unknown) => ctx.notices.error(errorMessage(error, __('Could not load older versions.', 'kotlinskidev-accessibility'))))
      .finally(() => {
        checkButton.disabled = false;
      });
  });

  select.addEventListener('change', () => {
    const requested = select.value === 'beta' ? 'beta' : 'stable';
    api
      .setChannel(requested)
      .then((state) => {
        apply(state);
        ctx.notices.success(__('Update channel saved.', 'kotlinskidev-accessibility'));
      })
      .catch((error: unknown) => ctx.notices.error(errorMessage(error, __('Could not save the update channel.', 'kotlinskidev-accessibility'))));
  });

  card.append(
    h('h3', { class: 'ka11y-subheading' }, __('Updates', 'kotlinskidev-accessibility')),
    h('label', { class: 'ka11y-field__label', for: select.id }, __('Update channel', 'kotlinskidev-accessibility')),
    select,
    help,
    rollbackHelp,
    checkButton,
    list
  );

  api
    .getChannel()
    .then(apply)
    .catch(() => card.remove());

  return card;
};

const updatesRoot = (ctx: FormContext): FormContext['config'] => ({ ...ctx.config, restRoot: ctx.config.restRoot.replace(/network\/$/, '') });

export const buildMaintenancePanel = (ctx: FormContext, fetcher: Fetcher | null = globalFetcher()): HTMLElement => {
  const network = ctx.schema.scope === 'network';
  return h(
    'div',
    { class: 'ka11y-panel ka11y-panel--maintenance' },
    network ? buildNetworkLocksCard(ctx) : null,
    fetcher === null ? null : buildUpdatesCard(ctx, createUpdatesApi(updatesRoot(ctx), fetcher)),
    network ? null : buildUninstallCard(ctx)
  );
};
