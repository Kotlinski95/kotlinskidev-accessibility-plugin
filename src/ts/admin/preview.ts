import { __ } from '@wordpress/i18n';
import { DEVICES, deviceLabel } from './labels';
import { h, uid } from './dom';
import type { FormState } from './state';

export const PREVIEW_SIZES: Readonly<Record<string, number>> = { sm: 40, md: 52, lg: 64 };

export const DEVICE_VIEWPORTS: Readonly<Record<string, { width: number; height: number }>> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1100 },
  mobile: { width: 390, height: 780 },
};

const FRAME_WIDTH: Readonly<Record<string, number>> = { desktop: 320, tablet: 205, mobile: 130 };

const TOKEN_VARIABLES: Readonly<Record<string, string>> = {
  primary: '--ka11y-primary',
  onPrimary: '--ka11y-on-primary',
  surfaceLight: '--ka11y-surface-light',
  surfaceDark: '--ka11y-surface-dark',
  textLight: '--ka11y-text-light',
  textDark: '--ka11y-text-dark',
  radius: '--ka11y-radius',
  zIndex: '--ka11y-z-index',
  fontFamily: '--ka11y-font-family',
};

export interface Placement {
  horizontal: 'left' | 'right';
  vertical: 'top' | 'bottom' | 'middle';
  style: Record<string, string>;
}

export const computePlacement = (position: string, offsetX: number, offsetY: number, scale: number): Placement => {
  const [verticalPart, horizontalPart] = position.split('-');
  const horizontal = horizontalPart === 'left' ? 'left' : 'right';
  const vertical = verticalPart === 'top' || verticalPart === 'middle' ? verticalPart : 'bottom';
  const x = `${Math.round(offsetX * scale)}px`;
  const style: Record<string, string> = { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto', transform: 'none' };
  style[horizontal] = x;
  if (vertical === 'middle') {
    style.top = '50%';
    style.transform = 'translateY(-50%)';
  } else {
    style[vertical] = `${Math.round(offsetY * scale)}px`;
  }
  return { horizontal, vertical, style };
};

const numberAt = (state: FormState, path: string, fallback: number): number => {
  const value = state.get(path);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const stringAt = (state: FormState, path: string, fallback: string): string => {
  const value = state.get(path);
  return typeof value === 'string' && value !== '' ? value : fallback;
};

export interface Preview {
  element: HTMLElement;
  device: () => string;
  refresh: () => void;
}

export const createPreview = (state: FormState, initialDevice = 'desktop'): Preview => {
  const id = uid('ka11y-preview');
  let device = DEVICES.includes(initialDevice) ? initialDevice : 'desktop';
  const select = h('select', { class: 'ka11y-select', id: `${id}-device` });
  for (const name of DEVICES) {
    const option = h('option', { value: name }, deviceLabel(name));
    option.selected = name === device;
    select.append(option);
  }
  const launcher = h('div', { class: 'ka11y-preview__launcher', 'aria-hidden': 'true' });
  const panelMock = h('div', { class: 'ka11y-preview__panel', 'aria-hidden': 'true' }, h('span', { class: 'ka11y-preview__bar' }), h('span', { class: 'ka11y-preview__bar' }));
  const frame = h('div', { class: 'ka11y-preview__frame' }, panelMock, launcher);
  const hidden = h('p', { class: 'ka11y-preview__hidden description' }, __('The widget is hidden on this device.', 'kotlinskidev-accessibility'));
  const caption = h('p', { class: 'ka11y-preview__caption description', id: `${id}-caption` });
  const element = h(
    'section',
    { class: 'ka11y-preview', 'aria-labelledby': `${id}-title` },
    h('h2', { class: 'ka11y-preview__title', id: `${id}-title` }, __('Live preview', 'kotlinskidev-accessibility')),
    h('label', { class: 'ka11y-field__label', for: `${id}-device` }, __('Preview device', 'kotlinskidev-accessibility')),
    select,
    h('div', { class: 'ka11y-preview__stage' }, frame),
    hidden,
    caption
  );

  const applyTokens = (): void => {
    for (const [token, variable] of Object.entries(TOKEN_VARIABLES)) {
      const value = state.get(`tokens.${token}`);
      if (typeof value === 'string' || typeof value === 'number') element.style.setProperty(variable, String(value));
    }
  };

  const refresh = (): void => {
    applyTokens();
    const viewport = DEVICE_VIEWPORTS[device] ?? { width: 1280, height: 800 };
    const width = FRAME_WIDTH[device] ?? 320;
    const scale = width / viewport.width;
    frame.style.width = `${width}px`;
    frame.style.height = `${Math.round(viewport.height * scale)}px`;
    const size = Math.max(14, Math.round((PREVIEW_SIZES[stringAt(state, 'widget.size', 'md')] ?? 52) * scale * 1.6));
    launcher.style.width = `${size}px`;
    launcher.style.height = `${size}px`;
    const placement = computePlacement(
      stringAt(state, `widget.position.${device}`, 'bottom-right'),
      numberAt(state, `widget.offsetX.${device}`, 20),
      numberAt(state, `widget.offsetY.${device}`, 20),
      scale
    );
    for (const [property, value] of Object.entries(placement.style)) launcher.style.setProperty(property, value);
    launcher.classList.toggle('has-border', state.get('widget.iconBorder') === true);
    const visible = state.get(`visibility.devices.${device}`) !== false;
    frame.hidden = !visible;
    hidden.hidden = visible;
    caption.textContent = `${deviceLabel(device)}: ${viewport.width}px`;
  };

  const onDeviceChange = (): void => {
    device = select.value;
    refresh();
  };
  select.addEventListener('change', onDeviceChange);
  state.subscribe(refresh);
  refresh();

  return { element, device: () => device, refresh };
};
