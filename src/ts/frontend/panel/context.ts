import type { Store, StoreState } from '../store';
import type { Translator } from '../translate';
import type { IconFactory } from './icons';

export interface PanelContext {
  doc: Document;
  t: Translator;
  icon: IconFactory;
  store: Store;
  listen(target: EventTarget, type: string, handler: EventListener): void;
}

export interface Control {
  nodes: HTMLElement[];
  update(state: StoreState): void;
}
