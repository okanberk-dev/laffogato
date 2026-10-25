#!/usr/bin/env node
/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver and the other engines that
 * share it) which laffogato.net addresses are new or changed, so they are
 * crawled in hours instead of weeks. No account is needed: the key below is
 * public by design and proves ownership by being served at
 * https://laffogato.net/45eddf5af665eb07607713cd177afc06.txt (public/45eddf5af665eb07607713cd177afc06.txt).
 *
 *   node scripts/indexnow.mjs                 every address in the live sitemap
 *   node scripts/indexnow.mjs /rehber/x /menu  only these paths
 *
 * Run it after a deploy that adds or rewrites pages (docs/SEO.md "IndexNow").
 * Google does not take part in IndexNow; Search Console's "Dizine eklenmesini
 * iste" and the sitemap cover it.
 */

const HOST = "laffogato.net";
const KEY = "45eddf5af665eb07607713cd177afc06";
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  const args = process.argv.slice(2);
  const urlList = args.length
    ? args.map((p) => (p.startsWith("http") ? p : `https://${HOST}${p}`))
    : await sitemapUrls();
  if (urlList.length === 0) throw new Error("no URLs to submit");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList,
    }),
  });
  // 200 and 202 both mean accepted; 202 while the key is being checked.
  console.log(`IndexNow: ${urlList.length} URL, HTTP ${res.status}`);
  if (res.status >= 400) {
    console.error(await res.text());
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
