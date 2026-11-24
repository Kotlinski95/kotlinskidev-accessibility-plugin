export type Translator = (key: string) => string;

export const createTranslator =
  (strings: Record<string, string>): Translator =>
  (key) => {
    const value = strings[key];
    return value ? value : key;
  };
