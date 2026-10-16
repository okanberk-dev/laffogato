import { createHash } from "node:crypto";

import {
  parse as parseHtml,
  type DefaultTreeAdapterTypes as Html,
} from "parse5";

import { priceLabel } from "@/lib/utils/format";

import { CARD_FORM_FIELDS, type CardField } from "./paynkolay-card";
import { paynkolayAmountToMinor, PAYNKOLAY_BRIDGE_PATH } from "./paynkolay";

/**
 * `/odeme/paynkolay`'ın çizdiği üç sayfa - her biri kendi CSP'siyle.
 *
 * Bu yol sitenin genel CSP'sinin DIŞINDA (`next.config.ts`): genel politika
 * `form-action`'ı yalnız siteye kısıtlıyor, oysa bu sayfalar PayNkolay'a ya
 * da kartı veren bankanın 3D adresine gönderir ve o host bankaya göre değişir. İki CSP başlığı birlikte uygulanır
 * (kesişim), yani genel politikayı burada genişletmek mümkün değil; bu yol
 * onun yerine her yanıtta KENDİ politikasını gönderir ve o politika genelden
 * daha dardır:
 *
 * - `default-src 'none'`: sayfa hiçbir yerden bir şey yüklemez.
 * - Betik ve stil yalnızca sayfanın kendi satır içi bloklarının SHA-256
 *   özetiyle çalışır - `'unsafe-inline'` yok, GTM yok, üçüncü taraf yok.
 *   Kart formunda üçüncü taraf betik, kart hırsızlığının (skimming) klasik
 *   yoludur.
 * - `frame-ancestors 'none'`: form başka bir sitenin içine gömülemez.
 *
 * Saf modül: veritabanına ve loga dokunmaz, testlerde doğrudan çağrılır.
 */

export interface PaynkolayPage {
  html: string;
  csp: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sha256Source(text: string): string {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

/**
 * The site's palette spelled out (this HTML is outside globals.css): the
 * porcelain ground (--bg #f7f3ed), the ink (--ink #211c18, --ink-soft
 * #564d46), the green (--brand #1d6d56) for the one action, bordo
 * (#9d2543 / #520f1f on #f9e6ea) for the brand line and the error. Bordo and
 * green never touch.
 */
const BASE_STYLE = `:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f7f3ed;color:#211c18;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
display:flex;justify-content:center;padding:24px 16px}
main{width:100%;max-width:26rem}
.brand{margin:0;font-weight:700;letter-spacing:.02em;color:#9d2543}
h1{margin:.25rem 0 0;font-size:1.5rem;line-height:1.2}
.lead{margin:.75rem 0 0;color:#564d46}
.amount{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
margin:1rem 0 1.25rem;padding:.875rem 1rem;background:#fff;border-radius:16px;
box-shadow:0 1px 2px rgba(59,42,30,.08)}
.amount span{color:#564d46;font-size:.9rem}
.amount strong{font-size:1.25rem}
form{background:#fff;border-radius:20px;padding:1.25rem;
box-shadow:0 8px 24px rgba(59,42,30,.08)}
label{display:block;font-size:.85rem;font-weight:600;margin:0 0 .375rem}
input{width:100%;font:inherit;font-size:1rem;padding:.75rem .875rem;
border:1px solid #d9d0c5;border-radius:12px;background:#fdfcfa;color:#211c18;
margin:0 0 1rem}
input:focus{outline:2px solid #1d6d56;outline-offset:1px;border-color:#1d6d56}
input[aria-invalid=true]{border-color:#9d2543}
.row{display:flex;gap:.75rem}
.row>div{flex:1;min-width:0}
button{width:100%;margin-top:.25rem;padding:.9rem 1.25rem;border:0;
border-radius:999px;background:#1d6d56;color:#fbf8f4;font:inherit;
font-weight:600;font-size:1.05rem;cursor:pointer}
button:active{transform:scale(.97)}
button:disabled{opacity:.7;cursor:progress}
.alert{margin:0 0 1rem;padding:.75rem 1rem;border-radius:12px;
background:#f9e6ea;color:#520f1f;font-size:.9rem}
.note{display:flex;gap:.5rem;align-items:flex-start;margin:1rem .25rem 0;
font-size:.82rem;color:#564d46}
.note svg{flex:none;margin-top:.2rem}
.psp{margin:.5rem .25rem 0;font-size:.75rem;color:#564d46}
.center{text-align:center;padding-top:20vh}
.next{display:inline-block;margin-top:.5rem;padding:.75rem 1.5rem;border-radius:999px;
background:#1d6d56;color:#fbf8f4;font-weight:600;text-decoration:none}`;

const LOCK_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path fill="#1d6d56" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Z"/>' +
  "</svg>";

/** Sayfa iskeleti + o sayfaya özgü CSP. */
function page(opts: {
  title: string;
  body: string;
  script?: string;
  formAction: string;
}): PaynkolayPage {
  const scriptTag = opts.script ? `<script>${opts.script}</script>` : "";
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="format-detection" content="telephone=no">
<title>${escapeHtml(opts.title)}</title>
<style>${BASE_STYLE}</style>
</head>
<body>
${opts.body}
${scriptTag}
</body>
</html>`;
  const csp = [
    "default-src 'none'",
    `script-src ${opts.script ? sha256Source(opts.script) : "'none'"}`,
    `style-src ${sha256Source(BASE_STYLE)}`,
    "img-src data:",
    `form-action ${opts.formAction}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  return { html, csp };
}

// ── Ortak ödeme sayfasına yönlendirme (`hosted`) ───────────────────────────

const AUTO_SUBMIT_SCRIPT =
  'document.getElementById("paynkolay-form").submit();';

/**
 * Script kapalıysa müşteri ekranda kalır; bu yüzden `<noscript>` içinde
 * elle basılabilen bir düğme var. Sayfa hiç görünmesin diye bir şey
 * yapılmıyor: yönlendirme milisaniyeler sürüyor ve boş bir beyaz ekran,
 * ödeme yaparken en çok korkulan şeydir.
 */
export function renderHostedRedirect(
  action: string,
  fields: Record<string, string>,
): PaynkolayPage {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");
  return page({
    title: "Güvenli ödemeye yönlendiriliyorsunuz…",
    formAction: new URL(action).origin,
    script: AUTO_SUBMIT_SCRIPT,
    body: `<main class="center">
<h1>Güvenli ödeme sayfasına yönlendiriliyorsunuz</h1>
<p class="lead">Kart bilgileriniz ödeme kuruluşunun sayfasında girilir.</p>
<form id="paynkolay-form" method="post" action="${escapeHtml(action)}">
${inputs}
<noscript><button type="submit">Ödemeye devam et</button></noscript>
</form>
</main>`,
  });
}

// ── Sitedeki kart formu (`direct`) ─────────────────────────────────────────

/**
 * Kolaylık betiği: kart numarasını dörder gruplar, son kullanmaya `/` koyar,
 * çift gönderimi engeller. Betiksiz form aynı sunucu doğrulamasından geçer.
 *
 * Son kullanma: Chrome `cc-exp`'i `AA/YYYY` olarak doldurur ("08/2029"); ilk
 * hâli bunu "08/20" yapıyordu ve her otomatik doldurma reddediliyordu. Yıl
 * "20" ile başlayıp dört haneye uzanıyorsa olduğu gibi kalır (sunucu
 * `AA/YYYY`'yi okur); tek haneli aydan sonra yazılan ayraç ("1/29") başa
 * sıfır koyar.
 *
 * Geri tuşu: sayfa `no-store` olsa da tarayıcı formun durumunu yeniden
 * doldurur; kart numarası ve güvenlik kodu her `pageshow`'da silinir (ortak
 * bir bilgisayarda bir sonraki kişi Geri'ye bastığında kart görünmesin).
 */
const CARD_FORM_SCRIPT = `(function(){
var f=document.getElementById("pay"),n=document.getElementById("cc-number"),
e=document.getElementById("cc-exp"),c=document.getElementById("cc-csc"),
b=document.getElementById("pay-btn"),label=b.textContent;
function digits(v){return v.replace(/\\D/g,"");}
n.addEventListener("input",function(){
n.value=digits(n.value).slice(0,19).replace(/(\\d{4})(?=\\d)/g,"$1 ");});
e.addEventListener("input",function(ev){
var raw=e.value,d=digits(raw);
if(/^\\d\\D/.test(raw))d="0"+d;
if(d.length>4&&d.slice(2,4)==="20"){d=d.slice(0,6);e.value=d.slice(0,2)+"/"+d.slice(2);return;}
d=d.slice(0,4);
if(ev.inputType&&ev.inputType.indexOf("delete")===0&&d.length<=2){e.value=d;return;}
e.value=d.length>=2?d.slice(0,2)+"/"+d.slice(2):d;});
c.addEventListener("input",function(){c.value=digits(c.value).slice(0,4);});
f.addEventListener("submit",function(ev){
if(f.getAttribute("data-sent")){ev.preventDefault();return;}
f.setAttribute("data-sent","1");b.disabled=true;
b.textContent="Bankaya yönlendiriliyorsun…";});
window.addEventListener("pageshow",function(ev){
n.value="";c.value="";
if(ev.persisted){f.removeAttribute("data-sent");b.disabled=false;b.textContent=label;}});
})();`;

export interface CardFormState {
  /** İmzalı yük ve imzası - forma gizli alan olarak geri yazılır. */
  data: string;
  signature: string;
  /** PayNkolay biçiminde tutar (`1280.10`), imzalı yükten. */
  amount: string;
  /** Müşteriye gösterilecek hata ve hangi alana ait olduğu. */
  error?: { message: string; field?: CardField };
  /**
   * Hata sonrası geri yazılabilecek alanlar. Kart numarası ve CVV BURADA
   * YOKTUR: bir hata sayfası kartı asla geri basmaz.
   */
  holderName?: string;
  expiry?: string;
}

function invalid(state: CardFormState, field: CardField): string {
  return state.error?.field === field
    ? ' aria-invalid="true" aria-describedby="pay-error"'
    : "";
}

export function renderCardForm(state: CardFormState): PaynkolayPage {
  const minor = paynkolayAmountToMinor(state.amount);
  const amount = minor === null ? state.amount : priceLabel(minor);
  const error = state.error
    ? `<p class="alert" id="pay-error" role="alert">${escapeHtml(state.error.message)}</p>`
    : "";
  return page({
    title: "Kartla öde · L'Affogato",
    formAction: "'self'",
    script: CARD_FORM_SCRIPT,
    body: `<main>
<p class="brand">L'Affogato</p>
<h1>Kartla öde</h1>
<p class="amount"><span>Ödenecek tutar</span><strong>${escapeHtml(amount)}</strong></p>
${error}
<form id="pay" method="post" action="${PAYNKOLAY_BRIDGE_PATH}" autocomplete="on">
<label for="cc-name">Kart üzerindeki ad</label>
<input id="cc-name" name="${CARD_FORM_FIELDS.holderName}" autocomplete="cc-name" autocapitalize="characters" spellcheck="false" maxlength="60" required value="${escapeHtml(state.holderName ?? "")}"${invalid(state, "holderName")}>
<label for="cc-number">Kart numarası</label>
<input id="cc-number" name="${CARD_FORM_FIELDS.number}" autocomplete="cc-number" inputmode="numeric" spellcheck="false" maxlength="23" placeholder="0000 0000 0000 0000" required${invalid(state, "number")}>
<div class="row">
<div>
<label for="cc-exp">Son kullanma</label>
<input id="cc-exp" name="${CARD_FORM_FIELDS.expiry}" autocomplete="cc-exp" inputmode="numeric" maxlength="7" placeholder="AA/YY" required value="${escapeHtml(state.expiry ?? "")}"${invalid(state, "expiry")}>
</div>
<div>
<label for="cc-csc">Güvenlik kodu</label>
<input id="cc-csc" name="${CARD_FORM_FIELDS.cvv}" autocomplete="cc-csc" inputmode="numeric" maxlength="4" placeholder="CVV" required${invalid(state, "cvv")}>
</div>
</div>
<input type="hidden" name="d" value="${escapeHtml(state.data)}">
<input type="hidden" name="s" value="${escapeHtml(state.signature)}">
<button type="submit" id="pay-btn">${escapeHtml(amount)} öde</button>
</form>
<p class="note">${LOCK_ICON}<span>Kart bilgilerin kaydedilmez; yalnızca bu ödeme için şifreli bağlantıyla ödeme kuruluşuna iletilir. Ödemeyi kartını veren bankanın 3D Secure ekranında onaylarsın.</span></p>
<p class="psp">Ödeme altyapısı: PayNkolay · N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.</p>
</main>`,
  });
}

/** Kart formunun yerine çizilen, devam edilemeyen durum sayfası. */
export function renderPaymentNotice(
  title: string,
  message: string,
  next?: { href: string; label: string },
): PaynkolayPage {
  const link = next
    ? `<p class="lead"><a class="next" href="${escapeHtml(next.href)}">${escapeHtml(next.label)}</a></p>`
    : "";
  return page({
    title: `${title} · L'Affogato`,
    formAction: "'none'",
    body: `<main class="center">
<p class="brand">L'Affogato</p>
<h1>${escapeHtml(title)}</h1>
<p class="lead">${escapeHtml(message)}</p>
${link}
</main>`,
  });
}

// ── Bankanın 3D formu ──────────────────────────────────────────────────────

/**
 * PayNkolay'ın döndürdüğü `BANK_REQUEST_MESSAGE`'ı müşteriye verirken
 * kullanılacak CSP.
 *
 * HTML PayNkolay'dan, sunucudan sunucuya TLS ile geliyor ve olduğu gibi
 * verilir: bir `<form>` + onu bankanın ACS adresine gönderen satır içi betik
 * ya da olay özniteliği. Bankaya göre üç biçim görüldü (sandbox, 2026-10-16):
 *
 * - QNB: `frm.action = 'https://…/Default.aspx'; frm.submit()` betiği.
 * - Garanti: `document.PostForm.submit()` betiği.
 * - Ziraat, Akbank, Denizbank, ING (EST tipi şablon, ACS hostları farklı):
 *   `<body onload=document.forms["form"].submit()>` - TIRNAKSIZ ve içinde
 *   çift tırnak olan bir değer.
 *
 * Betiğe `'unsafe-inline'` yerine BU yanıttaki her satır içi betiğin ve olay
 * özniteliğinin özeti izin verilir; HTML'e sonradan sızan bir betik
 * çalışmaz. Özet, tarayıcının okuduğu değerin aynısından hesaplanmalı:
 * sayfa bu yüzden düzenli ifadeyle değil, tarayıcıların kullandığı WHATWG
 * ayrıştırıcısıyla (parse5) okunur (`readBankMarkup`). Tırnaksız değeri ilk
 * `"`'da kesen eski okuma EST formunun özetini yanlış hesaplıyordu; tarayıcı
 * `onload`'u engelliyor, müşteri bembeyaz bir sayfada kalıyordu.
 *
 * `form-action https:` çünkü ACS hostu bankaya göre değişir ve önceden
 * bilinemez - düz `http:` hedefe kart akışı yine engellenir.
 *
 * Gövdenin başına bizim kısa bir notumuz eklenir: banka yanıt verene kadar
 * müşteri boş bir sayfa değil, ne olduğunu görür. Formun kendi adresi
 * mutlak bir https adresiyse 8 sn sonra bir "devam" düğmesi de belirir
 * (görünmesi yalnız CSS ile, gönderimi `form=` ile; betik gerekmez). Adres
 * göreliyse (QNB: asıl adresi betik yazıyor) düğme konmaz - göreli adres
 * bizim sitemize çözülür. Sayfa ayrılmaya başlayınca notun küçük betiği
 * düğmeyi gizler; banka yavaşken 3D formu ikinci kez gönderilmez.
 */
export function bankChallengePage(raw: string): PaynkolayPage {
  // Tarayıcı HTML'i ayrıştırırken CRLF ve tek CR'yi LF yapar ve CSP özetini
  // o metinden hesaplar. .NET/ASPX MPI çıktısında CRLF olağan (PayNkolay'ın
  // C# örneği de satır sonlarını siler). Sunulan bayt ile özetlenen bayt aynı
  // olsun diye satır sonları önce burada normalleştirilir.
  const bank = raw.replace(/\r\n?/g, "\n");
  const bankMarkup = readBankMarkup(bank);

  // Not yalnızca, eklendikten sonra yeniden okunan sayfa bankanın betik ve
  // öznitelik listesini AYNEN koruyorsa ve tek yeni betik notun kendi
  // betiğiyse kullanılır. Aksi hâlde banka sayfası notsuz verilir: not bir
  // kolaylık, izin listesi ise bankanın yazdığından ibaret kalmalı.
  let html = bank;
  let markup = bankMarkup;
  const at = noticeOffset(bankMarkup);
  if (at !== null && !bankMarkup.hasNoticeId) {
    const candidate =
      bank.slice(0, at) + bankNotice(bankMarkup.forms) + bank.slice(at);
    const reread = readBankMarkup(candidate);
    if (keepsBankMarkup(bankMarkup, reread)) {
      html = candidate;
      markup = reread;
    }
  }

  const scriptSources = new Set<string>();
  for (const script of markup.scripts) {
    if (script.src === null) {
      scriptSources.add(sha256Source(script.body));
      continue;
    }
    const origin = httpsOrigin(script.src);
    // Göreli adres bizim origin'imize çözülür; izin verilmez.
    if (origin) scriptSources.add(origin);
  }
  for (const handler of markup.handlers) {
    scriptSources.add(sha256Source(handler));
  }

  const scriptSrc = scriptSources.size
    ? [
        ...(markup.handlers.length ? ["'unsafe-hashes'"] : []),
        ...scriptSources,
      ].join(" ")
    : "'none'";
  const csp = [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    // Banka işaretlemesi değişken; stil bir betik vektörü değil.
    "style-src 'unsafe-inline'",
    // Görsel ve yazı tipi yalnız gömülü: bu sayfa yalnızca bankaya giden bir
    // ara adımdır ve bizim origin'imizde çalışır. Dışarıdan görsel yüklemeye
    // izin vermek, bir betiğin çerezleri bir görsel isteğiyle dışarı
    // taşımasının yolunu açık bırakırdı.
    "img-src data:",
    "font-src data:",
    // 3DS2 cihaz parmak izi gizli bir iframe'le alınabiliyor.
    "frame-src https:",
    "form-action https:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; ");
  return { html, csp };
}

/** Mutlak (ya da `//` ile başlayan) https betik adresinin origin'i. */
function httpsOrigin(src: string): string | null {
  try {
    const url = new URL(src.startsWith("//") ? `https:${src}` : src);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

const NOTICE_ID = "laf-bank-wait";

/**
 * Bekleme notunun tek betiği. Sayfa ayrılmaya başlayınca (`beforeunload`,
 * `pagehide`: bankanın kendi gönderimi yola çıktı) gecikmeli düğmeyi gizler
 * ve düğmeye bir kez basılınca kapatır. Böylece banka yanıtı yavaşken
 * müşteri 3D formunu (içinde kart bilgisiyle) ikinci kez göndermez.
 */
const BANK_WAIT_SCRIPT = `(function(){var w=document.getElementById("${NOTICE_ID}");if(!w)return;
function leaving(){w.setAttribute("data-leaving","1");}
addEventListener("beforeunload",leaving);addEventListener("pagehide",leaving);
addEventListener("pageshow",function(e){if(e.persisted)w.removeAttribute("data-leaving");});
var b=w.querySelector("button");
if(b){b.addEventListener("click",function(){leaving();setTimeout(function(){b.disabled=true;},0);});}})();`;

/** Banka sayfasına eklenen bekleme notu ve gecikmeli "devam" düğmesi. */
function bankNotice(forms: BankForm[]): string {
  const target = forms.find(
    (f) => f.id && /^https:\/\//i.test(f.action.trim()),
  );
  const later = target
    ? `<p style="margin:1rem 0 0;color:#564d46;font-size:.9rem">Sayfa açılmadıysa aşağıdaki düğmeyle devam edebilirsin.</p>` +
      `<button type="submit" form="${escapeHtml(target.id)}" style="margin-top:1.25rem;padding:.8rem 1.5rem;border:0;border-radius:999px;background:#1d6d56;color:#fbf8f4;font:inherit;font-weight:600;cursor:pointer">Bankanın sayfasına git</button>`
    : `<p style="margin:1rem 0 0;color:#564d46;font-size:.9rem">Sayfa açılmazsa geri dönüp yeniden deneyebilirsin; kartından para çekilmedi.</p>`;
  return (
    `<div id="${NOTICE_ID}" style="font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#211c18;text-align:center;padding:20vh 16px 0">` +
    `<style>@keyframes laf-bank-reveal{to{visibility:visible}}#${NOTICE_ID} .later{visibility:hidden;animation:laf-bank-reveal 0s 8s forwards}#${NOTICE_ID}[data-leaving] .later{display:none}</style>` +
    `<p style="margin:0;font-weight:700;color:#9d2543">L'Affogato</p>` +
    `<p style="margin:.5rem 0 0">Bankanın 3D Secure doğrulama sayfasına yönlendiriliyorsun…</p>` +
    `<div class="later">${later}</div>` +
    `<script>${BANK_WAIT_SCRIPT}</script>` +
    `</div>`
  );
}

interface BankForm {
  id: string;
  action: string;
}

interface BankScript {
  /** Dış betiğin adresi; satır içi betikte null. */
  src: string | null;
  /** Satır içi betiğin tarayıcının gördüğü metni. */
  body: string;
}

interface BankMarkup {
  scripts: BankScript[];
  /** Olay özniteliklerinin (`onload=…`) tarayıcının okuduğu değeri. */
  handlers: string[];
  forms: BankForm[];
  /** `<body ...>` başlangıç etiketinin bittiği yer (kaynakta varsa). */
  bodyStartEnd: number | null;
  /** Gövdenin kaynakta yeri olan ilk çocuğunun başladığı yer. */
  firstBodyChildStart: number | null;
  /** Bankanın sayfasında bizim not kimliğimizi taşıyan bir öğe var mı. */
  hasNoticeId: boolean;
  /** Not, gövdenin doğrudan çocuğu olarak bulundu mu (yeniden okumada). */
  noticeInBody: boolean;
}

/**
 * Banka HTML'ini tarayıcıların kullandığı WHATWG ayrıştırıcısıyla (parse5)
 * okur: satır içi betiklerin metni, olay özniteliklerinin çözülmüş değeri,
 * formlar ve notun gireceği yer. Elle yazılmış bir okuyucu tırnaksız
 * değerlerde, Türkçe "İ"de, betik içindeki `<!--` kaçışlarında ve karakter
 * referanslarında art arda tarayıcıdan ayrıştı (PR #113 incelemeleri);
 * özetin tarayıcınınkiyle aynı olması için ayrıştırmayı standart yapar.
 *
 * `<template>` içeriği çalışmaz ve atlanır; SVG içindeki `<script>` çalışır
 * ve sayılır.
 */
function readBankMarkup(html: string): BankMarkup {
  const doc = parseHtml(html, {
    sourceCodeLocationInfo: true,
    scriptingEnabled: true,
  });
  const out: BankMarkup = {
    scripts: [],
    handlers: [],
    forms: [],
    bodyStartEnd: null,
    firstBodyChildStart: null,
    hasNoticeId: false,
    noticeInBody: false,
  };

  const visit = (node: Html.Node, inBody: boolean): void => {
    if (!("tagName" in node)) {
      if ("childNodes" in node) {
        for (const child of node.childNodes) visit(child, inBody);
      }
      return;
    }
    const el = node as Html.Element;
    const attr = (name: string): string | undefined =>
      el.attrs.find((a) => a.name === name && !a.prefix)?.value;
    for (const a of el.attrs) {
      if (/^on[a-z]+$/i.test(a.name)) out.handlers.push(a.value);
    }
    if (attr("id") === NOTICE_ID) {
      out.hasNoticeId = true;
      if (inBody && el.parentNode && "tagName" in el.parentNode) {
        out.noticeInBody = el.parentNode.tagName === "body";
      }
    }
    if (el.tagName === "form") {
      out.forms.push({ id: attr("id") ?? "", action: attr("action") ?? "" });
    }
    if (el.tagName === "script") {
      const src = attr("src");
      out.scripts.push({
        src: src === undefined ? null : src.trim(),
        body: src === undefined ? textOf(el) : "",
      });
    }
    if (el.tagName === "body" && el.namespaceURI === HTML_NS) {
      out.bodyStartEnd = el.sourceCodeLocation?.startTag?.endOffset ?? null;
      const first = el.childNodes.find((c) => c.sourceCodeLocation);
      out.firstBodyChildStart = first?.sourceCodeLocation?.startOffset ?? null;
    }
    // Şablon içeriği belgeye girmez, betikleri çalışmaz.
    if (el.tagName === "template") return;
    for (const child of el.childNodes) {
      visit(child, inBody || el.tagName === "body");
    }
  };
  visit(doc, false);
  return out;
}

const HTML_NS = "http://www.w3.org/1999/xhtml";

function textOf(el: Html.Element): string {
  return el.childNodes
    .map((c) => ("value" in c && c.nodeName === "#text" ? c.value : ""))
    .join("");
}

/**
 * Notun gireceği yer: `<body>` etiketinin hemen ardı, etiket yazılmamışsa
 * gövdenin ilk öğesinin önü, gövde boşsa sayfanın sonu. Not, bankanın
 * gönderen betiğinden ÖNCE gelmeli: tarayıcı betik gezinmeyi başlatınca
 * sayfanın kalanını ayrıştırmayı bırakıyor (Garanti, QNB), sonda kalan not
 * hiç görünmüyordu.
 */
function noticeOffset(markup: BankMarkup): number | null {
  if (markup.bodyStartEnd !== null) return markup.bodyStartEnd;
  return markup.firstBodyChildStart;
}

/** Not eklendikten sonra bankanın betik ve öznitelikleri aynı mı? */
function keepsBankMarkup(bank: BankMarkup, withNotice: BankMarkup): boolean {
  if (!withNotice.noticeInBody) return false;
  const ours: BankScript = { src: null, body: BANK_WAIT_SCRIPT };
  const expected = [...bank.scripts.map(scriptKey), scriptKey(ours)].sort();
  const actual = withNotice.scripts.map(scriptKey).sort();
  if (expected.length !== actual.length) return false;
  if (expected.some((k, i) => k !== actual[i])) return false;
  const a = [...bank.handlers].sort();
  const b = [...withNotice.handlers].sort();
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

function scriptKey(s: BankScript): string {
  return s.src === null ? `inline:${s.body}` : `src:${s.src}`;
}
