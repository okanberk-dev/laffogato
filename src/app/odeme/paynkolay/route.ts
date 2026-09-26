import { NextResponse, type NextRequest } from "next/server";

import { getPaymentProvider } from "@/lib/payment";
import { PaynkolayPaymentProvider } from "@/lib/payment/paynkolay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayNkolay ödeme formunu kuran ve kendiliğinden gönderen ara sayfa.
 *
 * PayNkolay yönlendirilecek bir URL vermiyor: `/Vpos` ucu form-POST bekliyor
 * (docs/PAYNKOLAY.md §9). Oysa `CheckoutSession` tek bir `redirectUrl`
 * taşıyor ve mobil uygulama o adresi `WebBrowser` ile açıyor - uygulama form
 * POST edemez. Aradaki farkı kapatan yer burası: alanlar imzalı olarak URL'de
 * gelir, sayfa onları gizli input'lara koyup POS'a gönderir.
 *
 * Alanların çoğu zaten `hashDataV2` ile korunuyor; `currencyCode`,
 * `transactionType` ve `use3D` değil. Bu yüzden yük ayrıca imzalanıyor ve
 * imza tutmazsa form hiç kurulmuyor - yoksa müşteri `use3D`'yi boşaltıp 3D'siz
 * ödeyebilirdi.
 */
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = safeProvider();
  if (!(provider instanceof PaynkolayPaymentProvider)) {
    return failure(base);
  }

  const post = provider.readBridgePost(
    req.nextUrl.searchParams.get("d") ?? "",
    req.nextUrl.searchParams.get("s") ?? "",
  );
  if (!post) {
    console.error("[odeme/paynkolay] imzasız ya da bozuk ödeme yükü");
    return failure(base);
  }

  return new NextResponse(renderAutoSubmitForm(post.action, post.fields), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function safeProvider() {
  try {
    return getPaymentProvider();
  } catch (err) {
    console.error("[odeme/paynkolay] payment provider unavailable", err);
    return null;
  }
}

function failure(base: string) {
  // `?error=payment` is what /odeme renders a notice for (CHECKOUT_NOTICES);
  // `?durum=basarisiz` was read by nothing, so a declined card came back to
  // the checkout with no word about what had happened.
  return NextResponse.redirect(new URL("/odeme?error=payment", base), 303);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Script kapalıysa müşteri ekranda kalır; bu yüzden `<noscript>` içinde
 * elle basılabilen bir düğme var. Sayfa hiç görünmesin diye bir şey
 * yapılmıyor: yönlendirme milisaniyeler sürüyor ve boş bir beyaz ekran,
 * ödeme yaparken en çok korkulan şeydir.
 *
 * This page is standalone HTML, outside globals.css, so it spells the
 * site's colours out: the porcelain ground (--bg #f7f3ed), the ink
 * (--ink #211c18, --ink-soft #564d46) and the button in --brand (#1d6d56),
 * the app's palette since 25 Eyl 2026.
 */
function renderAutoSubmitForm(
  action: string,
  fields: Record<string, string>,
): string {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Güvenli ödemeye yönlendiriliyorsunuz…</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f7f3ed;color:#211c18}
main{text-align:center;padding:2rem;max-width:22rem}
p{margin:.75rem 0 0;font-size:.9rem;color:#564d46}
button{margin-top:1.25rem;padding:.75rem 1.5rem;border:0;border-radius:999px;
background:#1d6d56;color:#fbf8f4;font-size:1rem;font-weight:600;cursor:pointer}
</style>
</head>
<body>
<main>
<h1 style="font-size:1.125rem;font-weight:600">Güvenli ödeme sayfasına yönlendiriliyorsunuz</h1>
<p>Kart bilgileriniz bankanın sayfasında girilir; bu sayfa onları görmez.</p>
<form id="paynkolay-form" method="post" action="${escapeHtml(action)}">
${inputs}
<noscript><button type="submit">Ödemeye devam et</button></noscript>
</form>
</main>
<script>document.getElementById("paynkolay-form").submit();</script>
</body>
</html>`;
}
