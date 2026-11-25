export const i18nMock = {
  __: (text: string): string => text,
  _n: (single: string, plural: string, count: number): string => (count === 1 ? single : plural),
  sprintf: (format: string, ...args: ReadonlyArray<string | number>): string => {
    let index = 0;
    return format.replace(/%(?:(\d+)\$)?[sd]/g, (_match, position: string | undefined) => {
      const value = position === undefined ? args[index++] : args[Number(position) - 1];
      return String(value);
    });
  },
};

export const apiFetchMock = { __esModule: true, default: jest.fn() };
