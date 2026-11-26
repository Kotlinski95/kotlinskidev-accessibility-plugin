import { expect, gotoHome, openPanel, test } from './support/fixtures';
import { wpCli } from './support/wp-cli';
import {
  activateCurrent,
  activateRelease,
  effectiveSettings,
  installRelease,
  removeRelease,
  resetPluginData,
  seedSettings,
  settingsFixture,
} from './support/releases';
import type { SettingsTree } from './support/releases';
import { createSettingsClient } from './support/settings';

const DOWNGRADE_TARGET = '0.4.0';

test.describe('@upgrade downgrade', () => {
  test.describe.configure({ timeout: 180_000 });

  test.afterAll(() => {
    removeRelease();
    resetPluginData();
    activateCurrent();
  });

  test(`current build to v${DOWNGRADE_TARGET} keeps working settings @upgrade`, async ({ page, admin }) => {
    resetPluginData();
    activateCurrent();
    seedSettings(settingsFixture('full-v4'));
    wpCli('ka11y', 'settings', 'set', 'widget.size', 'lg', '--quiet');
    wpCli('ka11y', 'settings', 'set', 'theme.mode', 'light', '--quiet');
    const current = effectiveSettings();

    installRelease(DOWNGRADE_TARGET);
    activateRelease();
    expect((await admin.get('/wp-admin/')).ok()).toBe(true);

    const client = await createSettingsClient(admin);
    const downgraded: SettingsTree = await client.get();
    expect(downgraded).toMatchObject({ widget: { size: 'lg' }, theme: { mode: 'light' } });
    expect(downgraded['features']).toEqual(current['features']);

    const widget = await gotoHome(page);
    await openPanel(page, widget);
    await expect(widget.panel).toBeVisible();
  });
});
