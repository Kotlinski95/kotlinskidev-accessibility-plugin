const STATE = {
  classes: ['ka11y-reading-line', 'ka11y-highlight-links'],
  vars: {},
  levels: { readingLine: true, highlightLinks: true },
};

module.exports = async (browser, context) => {
  const page = await browser.newPage();
  await page.goto(context.url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((state) => {
    window.localStorage.setItem('ka11y', JSON.stringify({ ...state, exp: Date.now() + 86400000 }));
  }, STATE);
  await page.close();
};
