export const resetDocument = (): void => {
  document.documentElement.removeAttribute('class');
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = '';
  document.body.removeAttribute('class');
  document.body.removeAttribute('style');
};

export const flushObserver = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const mockMatchMedia = (matches: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({ matches, media: query, addEventListener: jest.fn(), removeEventListener: jest.fn() }) as unknown as MediaQueryList,
  });
};

export const runAnimationFramesSync = (): void => {
  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    callback(0);
    return 1;
  };
  window.cancelAnimationFrame = jest.fn();
};
