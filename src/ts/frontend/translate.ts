export interface Translator {
  (key: string): string;
  format(key: string, value: string): string;
}

export const createTranslator = (strings: Record<string, string>): Translator => {
  const translate = (key: string): string => {
    const value = strings[key];
    return value ? value : key;
  };
  return Object.assign(translate, {
    format: (key: string, value: string): string => translate(key).replace('%s', value),
  });
};
