import type { FeatureModule } from '../../apply';
import { ROOT_ID } from '../../root';
import { createExclusion, elementOf, MAGNIFIER_ATTRIBUTE } from './exclusions';

interface Pointer {
  x: number;
  y: number;
  target: EventTarget | null;
}

const MAX_LENGTH = 240;
const OFFSET = 18;
const MARGIN = 8;
const TOOLTIP_STYLE = [
  'position:fixed',
  'z-index:2147483647',
  'max-width:min(32rem,90vw)',
  'padding:.75rem 1rem',
  'background:#000',
  'color:#fff',
  'border:2px solid #fff',
  'border-radius:.5rem',
  'box-shadow:0 .25rem 1rem rgba(0,0,0,.4)',
  'font:600 2rem/1.4 system-ui,sans-serif',
  'letter-spacing:normal',
  'text-align:start',
  'pointer-events:none',
  'overflow-wrap:anywhere',
].join(';');

let tooltip: HTMLElement | null = null;
let pointer: Pointer | null = null;
let frame = 0;
let isExcluded = createExclusion();

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);

const ownText = (element: Element): string =>
  Array.from(element.childNodes)
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.nodeValue ?? '')
    .join(' ');

const textAt = (target: EventTarget | null): string => {
  if (!(target instanceof Node)) return '';
  const element = elementOf(target);
  if (!element || isExcluded(element)) return '';
  const own = normalize(ownText(element));
  return own !== '' ? own : normalize(element.textContent ?? '');
};

const hide = (): void => {
  if (tooltip) tooltip.hidden = true;
};

const place = (element: HTMLElement, x: number, y: number): void => {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const left = Math.max(MARGIN, Math.min(x + OFFSET, window.innerWidth - width - MARGIN));
  const top = Math.max(MARGIN, Math.min(y + OFFSET, window.innerHeight - height - MARGIN));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
};

const onFrame = (): void => {
  frame = 0;
  if (!tooltip || !pointer) return;
  const text = textAt(pointer.target);
  if (text === '') {
    hide();
    return;
  }
  tooltip.textContent = text;
  tooltip.hidden = false;
  place(tooltip, pointer.x, pointer.y);
};

const schedule = (): void => {
  if (frame === 0) frame = window.requestAnimationFrame(onFrame);
};

const onMouseMove = (event: MouseEvent): void => {
  pointer = { x: event.clientX, y: event.clientY, target: event.target };
  schedule();
};

const onFocusIn = (event: FocusEvent): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const rect = target.getBoundingClientRect();
  pointer = { x: rect.left, y: rect.bottom, target };
  schedule();
};

const onMouseLeave = (): void => {
  pointer = null;
  hide();
};

const createTooltip = (): HTMLElement => {
  const element = document.createElement('div');
  element.setAttribute(MAGNIFIER_ATTRIBUTE, '');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('style', TOOLTIP_STYLE);
  element.hidden = true;
  return element;
};

const mountPoint = (): ParentNode => document.getElementById(ROOT_ID)?.shadowRoot ?? document.body;

const on = (): void => {
  if (tooltip) return;
  isExcluded = createExclusion();
  tooltip = createTooltip();
  mountPoint().append(tooltip);
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('focusin', onFocusIn);
  document.documentElement.addEventListener('mouseleave', onMouseLeave);
};

const off = (): void => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('focusin', onFocusIn);
  document.documentElement.removeEventListener('mouseleave', onMouseLeave);
  if (frame !== 0) window.cancelAnimationFrame(frame);
  frame = 0;
  pointer = null;
  tooltip?.remove();
  tooltip = null;
};

export const textMagnifier: FeatureModule = { key: 'textMagnifier', on, off };
