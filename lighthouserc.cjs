const base = process.env.LHCI_BASE_URL || 'http://localhost:8889';
const urls = (process.env.LHCI_URLS || `${base}/`).split(',').filter(Boolean);
const outputDir = process.env.LHCI_OUTPUT_DIR || 'lh-results/on';
const puppeteerScript = process.env.LHCI_PUPPETEER_SCRIPT;

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 5,
      ...(puppeteerScript ? { puppeteerScript } : {}),
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
        onlyCategories: ['performance'],
        ...(puppeteerScript ? { disableStorageReset: true } : {}),
      },
    },
    assert: {
      assertions: {
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.01 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir,
    },
  },
};
