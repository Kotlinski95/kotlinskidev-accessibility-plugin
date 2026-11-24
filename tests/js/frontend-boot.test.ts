import type { KotlinskidevA11yConfig } from '../../src/ts/shared/types';

const createStore = jest.fn((): never => {
  throw new Error('boot reached');
});

jest.mock('../../src/ts/frontend/store', () => ({ createStore }));

const runFrontend = async (): Promise<void> => {
  jest.resetModules();
  await import('../../src/ts/frontend/index');
};

describe('frontend boot', () => {
  beforeEach(() => {
    createStore.mockClear();
    window.kotlinskidevA11y = {} as KotlinskidevA11yConfig;
    delete window.kotlinskidevA11yOff;
  });

  it('boots when the page is not switched off', async () => {
    await expect(runFrontend()).rejects.toThrow('boot reached');
    expect(createStore).toHaveBeenCalled();
  });

  it('does nothing when the bootstrap switched the widget off for the page view', async () => {
    window.kotlinskidevA11yOff = true;
    await expect(runFrontend()).resolves.toBeUndefined();
    expect(createStore).not.toHaveBeenCalled();
  });
});
