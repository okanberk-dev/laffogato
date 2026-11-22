const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [url, name, w, h, mobile] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', locale: 'en-US' });
  const page = await ctx.newPage();
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch (e) { console.log('goto err', e.message); }
  await page.waitForTimeout(6000);
  // dismiss cookie banners
  for (const t of ['Accept', 'Accept All', 'Accept all', 'OK', 'Got it', 'Close']) { try { const b = page.getByRole('button', { name: t, exact: true }); if (await b.count()) { await b.first().click({ timeout: 1500 }); } } catch {} }
  // scroll through to trigger lazy images
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(+h * 0.8)) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(350); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${process.argv[7] || '.'}/${name}.png`, fullPage: true });
  fs.writeFileSync(`${process.argv[7] || '.'}/${name}.dom.html`, await page.content());
  console.log(name, 'height', await page.evaluate(() => document.documentElement.scrollHeight));
  await browser.close();
})();
