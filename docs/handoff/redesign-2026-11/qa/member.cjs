// usage: node member.cjs <path> <outPrefix> <w> <h> <mobile> [withCart]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [p, out, w, h, mobile, withCart] = process.argv.slice(2);
  const S = (process.env.QA_DIR || '/tmp/laffogato-qa') + '/qa';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, isMobile: !!+mobile, hasTouch: !!+mobile });
  const v = encodeURIComponent(JSON.stringify({ version: 2, decidedAt: '2026-11-21T00:00:00.000Z', preferences: false, analytics: false, marketing: false }));
  await ctx.addCookies([
    { name: 'laffogato_cookie_consent', value: v, url: 'http://localhost:3000' },
    { name: 'laffogato_customer_session', value: fs.readFileSync(S + '/session.txt', 'utf8'), url: 'http://localhost:3000' },
  ]);
  if (+withCart) {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('laffogato_cart_v1', JSON.stringify([
        { productId: 'prd-0001', name: 'Sirena Espresso Blend 250 g', price: 480, qty: 2, slug: 'sirena-espresso-blend', cat: 'beans' },
        { productId: 'prd-0005', name: 'Bambu Chasen', price: 420, qty: 1, slug: 'bambu-chasen', cat: 'gear' },
      ])); } catch {}
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(JSON.stringify({ p, url: page.url(), overflow, errors: errors.slice(0, 5) }));
  await browser.close();
})();
