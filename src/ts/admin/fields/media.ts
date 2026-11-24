import { __, sprintf } from '@wordpress/i18n';
import type { FieldContext } from '../context';
import { button, h, uid } from '../dom';
import type { FieldOptions } from '../dom';

export const UNIVERSAL_ICON = 'universal';

const describe = (value: unknown): string => {
  if (typeof value === 'number' && value > 0) return sprintf(__('Attachment #%d', 'kotlinskidev-accessibility'), value);
  return __('Default icon', 'kotlinskidev-accessibility');
};

export const createMediaField = (ctx: FieldContext, options: FieldOptions): HTMLElement => {
  const id = uid('ka11y-media');
  const status = h('span', { class: 'ka11y-media__status', id: `${id}-status` });
  const preview = h('img', { class: 'ka11y-media__preview', alt: '', hidden: true });

  const render = (url?: string): void => {
    status.textContent = describe(ctx.state.get(options.path));
    if (url !== undefined && url !== '') {
      preview.src = url;
      preview.hidden = false;
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
    }
  };

  const onChoose = (): void => {
    const factory = window.wp?.media;
    if (factory === undefined) return;
    const frame = factory({
      title: __('Choose launcher icon', 'kotlinskidev-accessibility'),
      button: { text: __('Use this icon', 'kotlinskidev-accessibility') },
      library: { type: 'image' },
      multiple: false,
    });
    const onSelect = (): void => {
      const selection = frame.state().get('selection').first().toJSON();
      ctx.state.set(options.path, selection.id);
      render(selection.url);
    };
    frame.on('select', onSelect);
    frame.open();
  };

  const onUseDefault = (): void => {
    ctx.state.set(options.path, UNIVERSAL_ICON);
    render();
  };

  const choose = button(__('Choose icon', 'kotlinskidev-accessibility'), 'button', onChoose);
  choose.id = id;
  choose.setAttribute('aria-describedby', `${id}-status`);
  render();

  return h(
    'div',
    { class: 'ka11y-field ka11y-field--media' },
    h('span', { class: 'ka11y-field__label' }, options.label),
    h(
      'div',
      { class: 'ka11y-media' },
      preview,
      status,
      choose,
      button(__('Use default icon', 'kotlinskidev-accessibility'), 'button', onUseDefault)
    ),
    options.help ? h('p', { class: 'description ka11y-field__help' }, options.help) : null
  );
};
