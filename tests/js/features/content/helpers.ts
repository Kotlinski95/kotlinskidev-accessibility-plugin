import { createConfig } from '../../helpers';

export interface Frames {
  step(): void;
  flush(): void;
  restore(): void;
}

export const installFrames = (): Frames => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });

  const step = (): void => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback(0));
  };

  const flush = (): void => {
    for (let guard = 0; callbacks.size > 0 && guard < 1000; guard += 1) step();
  };

  const restore = (): void => {
    request.mockRestore();
    cancel.mockRestore();
    callbacks.clear();
  };

  return { step, flush, restore };
};

export const setExcludeSelectors = (excludeSelectors: string): void => {
  window.kotlinskidevA11y = createConfig({ advanced: { excludeSelectors } });
};

export const resetDocument = (): void => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('class');
  document.documentElement.removeAttribute('style');
  window.kotlinskidevA11y = createConfig();
};

export const flushMutations = async (): Promise<void> => {
  await Promise.resolve();
};
