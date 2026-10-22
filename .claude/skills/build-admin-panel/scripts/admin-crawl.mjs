// Real-browser sweep of the Laffogato admin (.claude/skills/build-admin-panel):
// signs in through /admin/giris (and /admin/iki-asama when 2FA is on),
// follows links from /admin to every admin page, and reports each page's
// status, console errors, page errors and failed requests; then checks
// every internal link it saw. Saves a full-page screenshot of Genel bakış.
//
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//     [ADMIN_TOTP_SECRET=base32] [MAX=200] [SHOT=admin-dashboard.png] \
//     node .claude/skills/build-admin-panel/scripts/admin-crawl.mjs
//
// Read-only: it never submits a form after signing in. Exit code 1 when
// anything was found. Playwright is not a project dependency: it is taken
// from the global install (`npm root -g`, or /opt/node-tools here).

import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function loadPlaywright() {
  const roots = [
    process.env.PLAYWRIGHT_NODE_MODULES,
    "/opt/node-tools/node_modules",
    (() => {
      try {
        return execSync("npm root -g", { encoding: "utf8" }).trim();
      } catch {
        return undefined;
      }
    })(),
  ].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(path.join(root, "playwright"))) continue;
    return createRequire(path.join(root, "noop.js"))("playwright");
  }
  throw new Error(
    "Playwright bulunamadı: `npm i -g playwright` ya da PLAYWRIGHT_NODE_MODULES.",
  );
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret. */
function totp(secret, now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/[\s=]/g, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("ADMIN_TOTP_SECRET base32 değil.");
    bits += v.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? [],
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, "0");
}

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const MAX = Number(process.env.MAX ?? 200);
const SHOT = process.env.SHOT ?? "admin-dashboard.png";
// Downloads, printouts and the way out are not pages to sweep.
const SKIP =
  /\/cikis|\/qr(\/|$)|\.csv|\/csv|export|indir|disa-aktar|download|yazdir|sablon/;
if (!EMAIL || !PASSWORD) {
  console.error("ADMIN_EMAIL ve ADMIN_PASSWORD gerekli.");
  process.exit(2);
}

const { chromium } = loadPlaywright();
const executablePath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH]
  .filter(Boolean)
  .find((p) => existsSync(p));
const browser = await chromium.launch(
  executablePath ? { executablePath } : {},
);
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "tr-TR",
  timezoneId: "Europe/Istanbul",
});
const page = await ctx.newPage();

let current = "(giriş)";
const problems = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  problems.push(`${current} CONSOLE: ${m.text().slice(0, 260)}`);
});
page.on("pageerror", (e) =>
  problems.push(`${current} PAGEERROR: ${e.message.slice(0, 260)}`),
);
page.on("requestfailed", (r) => {
  const why = r.failure()?.errorText ?? "";
  // A navigation that replaced an in-flight request is not a failure.
  if (/ERR_ABORTED/.test(why)) return;
  problems.push(`${current} REQUESTFAILED: ${r.url()} ${why}`);
});
page.on("response", (r) => {
  if (r.status() >= 400 && r.url().startsWith(BASE)) {
    problems.push(`${current} HTTP ${r.status()}: ${r.url().slice(BASE.length)}`);
  }
});

// Sign in.
await page.goto(`${BASE}/admin/giris`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/admin/giris"), {
    timeout: 30_000,
  }),
  page.click('button[type="submit"]'),
]).catch(() => undefined);
if (new URL(page.url()).pathname.startsWith("/admin/iki-asama")) {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) {
    console.error("İki adımlı doğrulama açık: ADMIN_TOTP_SECRET ver.");
    await browser.close();
    process.exit(2);
  }
  await page.fill('input[name="token"]', totp(secret));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/admin/iki-asama"), {
      timeout: 30_000,
    }),
    page.click('button[type="submit"]'),
  ]).catch(() => undefined);
}
if (/\/admin\/(giris|iki-asama)/.test(new URL(page.url()).pathname)) {
  console.error(`Giriş olmadı: ${page.url()}`);
  await browser.close();
  process.exit(1);
}

// Crawl.
const queue = ["/admin"];
const seen = new Set(queue);
const hrefs = new Map();
let visited = 0;
while (queue.length && visited < MAX) {
  const p = queue.shift();
  current = p;
  visited += 1;
  let status = 0;
  try {
    const res = await page.goto(BASE + p, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    status = res?.status() ?? 0;
  } catch (e) {
    // A link that turned out to be a file (a CSV template): not a page.
    if (/Download is starting/.test(String(e))) continue;
    problems.push(`${p} GOTO: ${String(e).slice(0, 200)}`);
    continue;
  }
  if (status >= 400) problems.push(`${p} STATUS ${status}`);
  const finalPath = new URL(page.url()).pathname;
  if (finalPath.startsWith("/admin/giris")) {
    problems.push(`${p} -> oturum düştü`);
    break;
  }
  if (p === "/admin") {
    await page.screenshot({ path: SHOT, fullPage: true });
  }
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => a.getAttribute("href")),
  );
  for (const h of links) {
    if (!h || !h.startsWith("/") || h.startsWith("//")) continue;
    if (!hrefs.has(h)) hrefs.set(h, p);
    const target = h.split("#")[0].split("?")[0];
    if (!target.startsWith("/admin") || SKIP.test(target) || seen.has(target))
      continue;
    seen.add(target);
    queue.push(target);
  }
}

// Every internal link seen, with its query: its status only.
const bad = [];
for (const [h, from] of hrefs) {
  const target = h.split("#")[0];
  if (SKIP.test(target)) continue;
  try {
    const r = await page.request.get(BASE + target, {
      maxRedirects: 5,
      timeout: 60_000,
    });
    if (r.status() >= 400) bad.push(`${r.status()} ${h}  (${from})`);
  } catch (e) {
    bad.push(`ERR ${h} (${from}): ${String(e).slice(0, 120)}`);
  }
}

console.log(
  `sayfa: ${visited}, kuyrukta kalan: ${queue.length}, bağlantı: ${hrefs.size}, ekran görüntüsü: ${SHOT}`,
);
console.log("--- sorunlar ---");
console.log(problems.join("\n") || "yok");
console.log("--- kırık bağlantılar ---");
console.log(bad.join("\n") || "yok");
await browser.close();
process.exit(problems.length || bad.length ? 1 : 0);
