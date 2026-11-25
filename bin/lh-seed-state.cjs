const STATE = {
  classes: ['ka11y-bigger-text', 'ka11y-reading-line'],
  vars: { '--ka11y-font-scale': '1.25' },
  levels: { readingLine: true, biggerText: 2 },
};

module.exports = async (browser, context) => {
  const page = await browser.newPage();
  await page.goto(context.url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((state) => {
    window.localStorage.setItem('ka11y', JSON.stringify({ ...state, exp: Date.now() + 86400000 }));
  }, STATE);
  await page.close();
};
