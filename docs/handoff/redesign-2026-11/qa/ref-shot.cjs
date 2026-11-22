const { chromium } = require('playwright');
(async () => {
  const [url, out, w, h] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ viewport: { width: +w || 1440, height: +h || 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', locale: 'en-US' });
  const page = await ctx.newPage();
  const failed = new Map();
  page.on('requestfailed', r => { const host = new URL(r.url()).host; failed.set(host, (failed.get(host)||0)+1); });
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { console.log('goto err', e.message); }
  await page.waitForTimeout(8000);
  console.log('title:', await page.title());
  await page.screenshot({ path: out, fullPage: false });
  require('fs').writeFileSync(out.replace(/\.png$/, '.dom.html'), await page.content());
  console.log('failed hosts:', [...failed].map(([h,n])=>h+':'+n).join(' '));
  await browser.close();
})();
