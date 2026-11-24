declare module '@wordpress/i18n' {
  export const __: (text: string, domain?: string) => string;
  export const sprintf: (format: string, ...args: ReadonlyArray<string | number>) => string;
}

declare module '@wordpress/api-fetch' {
  export interface ApiFetchOptions {
    url?: string;
    path?: string;
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
  }
  const apiFetch: <T>(options: ApiFetchOptions) => Promise<T>;
  export default apiFetch;
}
