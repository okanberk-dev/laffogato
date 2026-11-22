// usage: node shot.cjs <url> <outPrefix> <width> <height> [mobile] [scrollThrough]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w, h, mobile] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: !!+mobile, hasTouch: !!+mobile, reducedMotion: 'no-preference' });
  // Consent decided, so the cookie card stays out of the shots.
  if (!process.env.SHOW_COOKIE) {
    const v = encodeURIComponent(JSON.stringify({ version: +(process.env.CONSENT_V || 2), decidedAt: '2026-11-21T00:00:00.000Z', preferences: false, analytics: false, marketing: false }));
    await ctx.addCookies([{ name: 'laffogato_cookie_consent', value: v, url: 'http://localhost:3000' }]);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => errors.push('goto ' + e.message));
  await page.waitForTimeout(1200);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(+h * 0.8)) { await page.evaluate(yy => window.scrollTo(0, yy), y); await page.waitForTimeout(150); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(JSON.stringify({ url, height: H, overflowX: overflow, errors: errors.slice(0, 8) }));
  await browser.close();
})();
