import type { FeatureLevel } from '../../../shared/types';
import type { FeatureModule } from '../../apply';
import { createExclusion, SKIPPED_TAGS } from './exclusions';

export interface ScaleResult {
  value: string;
  ratio: number;
}

export interface ScaleStrategy {
  key: string;
  property: 'font-size' | 'line-height';
  inheritsScale: boolean;
  measure(computed: CSSStyleDeclaration): number | null;
  resolve(original: number, level: FeatureLevel): ScaleResult;
}

interface Entry {
  original: number;
  inline: string;
  priority: string;
  styleAttribute: string | null;
  cssText: string;
  ratio: number;
}

const BATCH_SIZE = 250;
const CONTROL_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

const hasOwnText = (element: HTMLElement): boolean =>
  CONTROL_TAGS.has(element.tagName) ||
  Array.from(element.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && (child.nodeValue ?? '').trim() !== '');

export const createTextScaler = (strategy: ScaleStrategy): FeatureModule => {
  const entries = new WeakMap<HTMLElement, Entry>();
  const written = new Set<HTMLElement>();
  let queue: HTMLElement[] = [];
  let level: FeatureLevel = false;
  let frame = 0;
  let observer: MutationObserver | null = null;
  let isExcluded = createExclusion();

  const isScalable = (element: Element): element is HTMLElement =>
    element instanceof HTMLElement && !SKIPPED_TAGS.has(element.tagName) && !isExcluded(element) && hasOwnText(element);

  const inheritedRatio = (element: HTMLElement): number => {
    let node = element.parentElement;
    while (node) {
      const entry = entries.get(node);
      if (entry) return entry.ratio;
      node = node.parentElement;
    }
    return 1;
  };

  const measure = (elements: Element[], isAdded: boolean): void => {
    elements.filter(isScalable).forEach((element) => {
      if (entries.has(element)) return;
      const raw = strategy.measure(window.getComputedStyle(element));
      if (raw === null || !Number.isFinite(raw) || raw <= 0) return;
      const original = isAdded && strategy.inheritsScale ? raw / inheritedRatio(element) : raw;
      entries.set(element, {
        original,
        inline: element.style.getPropertyValue(strategy.property),
        priority: element.style.getPropertyPriority(strategy.property),
        styleAttribute: element.getAttribute('style'),
        cssText: element.style.cssText,
        ratio: 1,
      });
      queue.push(element);
    });
  };

  const write = (element: HTMLElement): void => {
    const entry = entries.get(element);
    if (!entry) return;
    const result = strategy.resolve(entry.original, level);
    element.style.setProperty(strategy.property, result.value, 'important');
    entry.ratio = result.ratio;
    written.add(element);
  };

  const restore = (element: HTMLElement): void => {
    const entry = entries.get(element);
    if (!entry) return;
    if (entry.inline === '') element.style.removeProperty(strategy.property);
    else element.style.setProperty(strategy.property, entry.inline, entry.priority);
    if (element.style.cssText === entry.cssText) {
      if (entry.styleAttribute === null) element.removeAttribute('style');
      else element.setAttribute('style', entry.styleAttribute);
    }
    entries.delete(element);
  };

  const onFrame = (): void => {
    frame = 0;
    queue.splice(0, BATCH_SIZE).forEach(write);
    if (queue.length > 0) schedule();
  };

  const schedule = (): void => {
    if (frame === 0) frame = window.requestAnimationFrame(onFrame);
  };

  const collectAdded = (records: MutationRecord[]): Element[] =>
    records.flatMap((record) =>
      Array.from(record.addedNodes)
        .filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE)
        .flatMap((node) => [node, ...Array.from(node.querySelectorAll('*'))])
    );

  const onMutations = (records: MutationRecord[]): void => {
    measure(collectAdded(records), true);
    if (queue.length > 0) schedule();
  };

  const on = (next: FeatureLevel): void => {
    level = next;
    if (observer) {
      queue = [...written];
      schedule();
      return;
    }
    isExcluded = createExclusion();
    measure([document.body, ...Array.from(document.body.querySelectorAll('*'))], false);
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
  };

  const off = (): void => {
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    queue.forEach((element) => entries.delete(element));
    queue = [];
    written.forEach(restore);
    written.clear();
  };

  return { key: strategy.key, on, off };
};
