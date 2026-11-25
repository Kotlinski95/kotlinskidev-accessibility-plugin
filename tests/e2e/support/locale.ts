import type { BrowserContext } from '@playwright/test';
import { BASE_URL } from './env';

export const LOCALE_COOKIE = 'ka11y_fixture_locale';

export type FixtureLocale = 'en_US' | 'pl_PL' | 'he_IL';

export const setFixtureLocale = async (context: BrowserContext, locale: FixtureLocale): Promise<void> => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url: BASE_URL }]);
};
