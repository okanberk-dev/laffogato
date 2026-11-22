// Overlap / overflow scan: every page × viewport.
// usage: node overlap.cjs [onlyPathSubstring]
const { chromium } = require('playwright');
const fs = require('fs');
const S = (process.env.QA_DIR || '/tmp/laffogato-qa') + '/qa';
const PAGES = [
  ['/', 0, 0], ['/menu', 0, 0], ['/menu/espresso', 0, 0], ['/magaza', 0, 0], ['/magaza/cekirdek', 0, 0],
  ['/magaza/urun/sirena-espresso-blend', 0, 0], ['/hikayemiz', 0, 0], ['/ziyaret', 0, 0], ['/kampanyalar', 0, 0],
  ['/karaoke', 0, 0], ['/rehber', 0, 0], ['/rehber/affogato-nedir', 0, 0], ['/hukuk', 0, 0],
  ['/hukuk/mesafeli-satis-sozlesmesi', 0, 0], ['/uye/giris', 0, 0], ['/uye/kayit', 0, 0], ['/olmayan-sayfa', 0, 0],
  ['/odeme', 1, 1], ['/uye/hesap', 1, 0], ['/uye/hesap/siparislerim', 1, 0], ['/uye/hesap/adreslerim', 1, 0],
  ['/uye/hesap/bilgilerim', 1, 0], ['/uye/hesap/karaoke', 1, 0], ['/uye/hesap/kartlarim', 1, 0], ['/masa/ABCDEFGHJK', 0, 0],
];
const VIEWPORTS = [[360, 740, 1], [390, 844, 1], [768, 1024, 1], [1024, 768, 0], [1280, 800, 0], [1440, 900, 0]];

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch();
  const consent = encodeURIComponent(JSON.stringify({ version: 2, decidedAt: '2026-11-21T00:00:00.000Z', preferences: false, analytics: false, marketing: false }));
  const session = fs.readFileSync(S + '/session.txt', 'utf8');
  const report = [];
  for (const [path, member, cart] of PAGES) {
    if (only && !path.includes(only)) continue;
    for (const [w, h, mobile] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, reducedMotion: 'reduce' });
      const cookies = [{ name: 'laffogato_cookie_consent', value: consent, url: 'http://localhost:3000' }];
      if (member) cookies.push({ name: 'laffogato_customer_session', value: session, url: 'http://localhost:3000' });
      await ctx.addCookies(cookies);
      if (cart) await ctx.addInitScript(() => { try { localStorage.setItem('laffogato_cart_v1', JSON.stringify([{ productId: 'prd-0001', name: 'Sirena Espresso Blend 250 g', price: 480, qty: 2, slug: 'sirena-espresso-blend', cat: 'beans' }])); } catch {} });
      const page = await ctx.newPage();
      try { await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { report.push({ path, w, error: e.message.slice(0, 80) }); await ctx.close(); continue; }
      await page.waitForTimeout(500);
      const res = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = { overflowX: document.documentElement.scrollWidth - vw, offRight: [], overlaps: [], clipped: [] };
        const isHidden = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return true; if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true' && n.matches('.sheet,.cart-drawer,.mobile-sheet,.nav-panel')) return true; } return false; };
        const inFixed = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed') return true; } return false; };
        const label = (el) => { const c = (el.className && el.className.baseVal === undefined ? el.className : '') + ''; return el.tagName.toLowerCase() + (c ? '.' + c.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.innerText || el.alt || '').trim().slice(0, 30).replace(/\n/g, ' ') + '"'; };
        // text leaves
        const leaves = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const t = walker.currentNode; if (!t.textContent.trim()) continue;
          const el = t.parentElement; if (!el || isHidden(el) || inFixed(el)) continue;
          if (el.closest('.sr-only,script,style,noscript')) continue;
          const range = document.createRange(); range.selectNodeContents(t);
          for (const r of range.getClientRects()) { if (r.width < 2 || r.height < 2) continue; leaves.push({ el, r: { x: r.x, y: r.y + scrollY, w: r.width, h: r.height } }); }
        }
        for (const { el, r } of leaves) if (r.x + r.w > vw + 1 || r.x < -1) out.offRight.push(label(el) + ` x=${Math.round(r.x)} w=${Math.round(r.w)}`);
        // pairwise overlaps of text boxes from different elements
        const inter = (a, b) => { const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)); const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); return x * y; };
        leaves.sort((a, b) => a.r.y - b.r.y);
        for (let i = 0; i < leaves.length; i++) {
          for (let j = i + 1; j < leaves.length && leaves[j].r.y < leaves[i].r.y + leaves[i].r.h; j++) {
            const A = leaves[i], B = leaves[j];
            if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
            const a = inter(A.r, B.r); if (a < 12) continue;
            const minArea = Math.min(A.r.w * A.r.h, B.r.w * B.r.h);
            if (a / minArea < 0.2) continue;
            out.overlaps.push(label(A.el) + '  ×  ' + label(B.el));
          }
        }
        // text clipped by its own box (overflow hidden and wider than box)
        for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,label,dt,dd,li')) {
          if (isHidden(el) || inFixed(el)) continue; const s = getComputedStyle(el);
          if ((s.overflow === 'hidden' || s.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') out.clipped.push(label(el));
        }
        out.offRight = [...new Set(out.offRight)].slice(0, 6); out.overlaps = [...new Set(out.overlaps)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 6);
        return out;
      });
      if (res.overflowX > 0 || res.offRight.length || res.overlaps.length || res.clipped.length) report.push({ path, w, ...res });
      await ctx.close();
    }
  }
  fs.writeFileSync(S + '/overlap-report.json', JSON.stringify(report, null, 1));
  for (const r of report) {
    console.log(`\n${r.path} @${r.w}` + (r.error ? ' ERROR ' + r.error : '') + (r.overflowX > 0 ? ` overflowX=${r.overflowX}` : ''));
    for (const k of ['offRight', 'overlaps', 'clipped']) for (const x of r[k] || []) console.log(`  ${k}: ${x}`);
  }
  console.log('\nchecked; issues in', report.length, 'page×viewport combos');
  await browser.close();
})();
