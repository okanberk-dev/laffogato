const { chromium, devices } = require('playwright');
(async () => {
  const S = process.argv[2];
  const browser = await chromium.launch();
  const v = encodeURIComponent(JSON.stringify({ version: 2, decidedAt: '2026-11-21T00:00:00.000Z', preferences: false, analytics: false, marketing: false }));
  const mk = async (w, h, mobile) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile }); await ctx.addCookies([{ name: 'laffogato_cookie_consent', value: v, url: 'http://localhost:3000' }]); return ctx; };
  // desktop: open cart with an item, quick look, search, nav panel
  let ctx = await mk(1440, 900, false); let page = await ctx.newPage();
  await page.goto('http://localhost:3000/magaza', { waitUntil: 'networkidle' });
  await page.locator('.p-card-link').first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}/qa/i-quick.png` });
  await page.locator('.product-modal .buy-add').click(); await page.waitForTimeout(900);
  await page.screenshot({ path: `${S}/qa/i-cart.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.locator('.nav-link-wrap').first().hover(); await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}/qa/i-panel.png` });
  await page.mouse.move(700, 700); await page.waitForTimeout(400);
  await page.locator('button[aria-label="Ara"]').click(); await page.waitForTimeout(600);
  await page.keyboard.type('mat'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}/qa/i-search.png` });
  await ctx.close();
  // mobile: menu sheet, shop grid
  ctx = await mk(390, 844, true); page = await ctx.newPage();
  await page.goto('http://localhost:3000/magaza', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${S}/qa/m-shop.png`, fullPage: false });
  await page.locator('.nav-burger').click(); await page.waitForTimeout(500);
  await page.locator('.sheet-row').first().click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${S}/qa/m-sheet.png` });
  await page.locator('.nav-burger').click(); await page.waitForTimeout(300);
  await page.locator('.collection-filter').click(); await page.waitForTimeout(600);
  await page.screenshot({ path: `${S}/qa/m-filter.png` });
  await browser.close();
})();
