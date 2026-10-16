import { createHash } from "node:crypto";

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
 * - EST / Asseco altyapısı (Ziraat, Akbank, Denizbank, ING, …):
 *   `<body onload=document.forms["form"].submit()>` - TIRNAKSIZ ve içinde
 *   çift tırnak olan bir değer.
 *
 * Betiğe `'unsafe-inline'` yerine BU yanıttaki her satır içi betiğin ve olay
 * özniteliğinin özeti izin verilir; HTML'e sonradan sızan bir betik
 * çalışmaz. Özet, tarayıcının okuduğu değerin aynısından hesaplanmalı:
 * öznitelikler bu yüzden düzenli ifadeyle değil, tarayıcının ayrıştırma
 * kuralıyla okunur (`readBankMarkup`). Tırnaksız değeri ilk `"`'da kesen eski
 * okuma EST formunun özetini yanlış hesaplıyordu; tarayıcı `onload`'u
 * engelliyor, müşteri bembeyaz bir sayfada kalıyordu.
 *
 * `form-action https:` çünkü ACS hostu bankaya göre değişir ve önceden
 * bilinemez - düz `http:` hedefe kart akışı yine engellenir.
 *
 * Sayfanın sonuna bizim kısa bir notumuz eklenir: banka yanıt verene kadar
 * müşteri boş bir sayfa değil, ne olduğunu görür. Formun kendi adresi
 * mutlak bir https adresiyse, birkaç saniye sonra betiksiz çalışan bir
 * "devam" düğmesi de belirir (yalnız CSS ile; düğme `form=` ile formu
 * gönderir). Adres göreliyse (QNB: asıl adresi betik yazıyor) düğme
 * konmaz - göreli adres bizim sitemize çözülür.
 */
export function bankChallengePage(raw: string): PaynkolayPage {
  // Tarayıcı HTML'i ayrıştırırken CRLF ve tek CR'yi LF yapar ve CSP özetini
  // o metinden hesaplar. .NET/ASPX MPI çıktısında CRLF olağan (PayNkolay'ın
  // C# örneği de satır sonlarını siler). Sunulan bayt ile özetlenen bayt aynı
  // olsun diye satır sonları önce burada normalleştirilir.
  const bank = raw.replace(/\r\n?/g, "\n");
  const html = withBankNotice(bank, readBankMarkup(bank).forms);
  const markup = readBankMarkup(html);

  const scriptSources = new Set<string>();
  for (const script of markup.scripts) {
    if (script.src === null) {
      scriptSources.add(sha256Source(script.body));
      continue;
    }
    try {
      const url = new URL(script.src);
      if (url.protocol === "https:") scriptSources.add(url.origin);
    } catch {
      // Göreli adres bizim origin'imize çözülür; izin verilmez.
    }
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

/** Banka sayfasına eklenen bekleme notu ve gecikmeli "devam" düğmesi. */
function withBankNotice(html: string, forms: BankForm[]): string {
  const target = forms.find(
    (f) => f.id && /^https:\/\//i.test(f.action.trim()),
  );
  const button = target
    ? `<button type="submit" form="${escapeHtml(target.id)}" style="margin-top:1.25rem;padding:.8rem 1.5rem;border:0;border-radius:999px;background:#1d6d56;color:#fbf8f4;font:inherit;font-weight:600;cursor:pointer">Bankanın sayfasına git</button>`
    : "";
  const notice =
    `<div id="laf-bank-wait" style="font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#211c18;text-align:center;padding:20vh 16px 0">` +
    `<style>@keyframes laf-bank-reveal{to{visibility:visible}}#laf-bank-wait .later{visibility:hidden;animation:laf-bank-reveal 0s 6s forwards}</style>` +
    `<p style="margin:0;font-weight:700;color:#9d2543">L'Affogato</p>` +
    `<p style="margin:.5rem 0 0">Bankanın 3D Secure doğrulama sayfasına yönlendiriliyorsun…</p>` +
    `<div class="later"><p style="margin:1rem 0 0;color:#564d46;font-size:.9rem">Sayfa açılmadıysa aşağıdaki düğmeyle devam edebilirsin.</p>${button}</div>` +
    `</div>`;
  const close = html.search(/<\/body\s*>/i);
  return close === -1
    ? html + notice
    : html.slice(0, close) + notice + html.slice(close);
}

interface BankForm {
  id: string;
  action: string;
}

interface BankMarkup {
  /** Satır içi betiklerin gövdesi (`src: null`) ya da dış betiğin adresi. */
  scripts: { src: string | null; body: string }[];
  /** Olay özniteliklerinin (`onload=…`) tarayıcının okuduğu değeri. */
  handlers: string[];
  forms: BankForm[];
}

/** İçeriği HTML olarak ayrıştırılmayan öğeler: kapanış etiketine dek atlanır. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp"]);

/**
 * Banka HTML'indeki betikleri, olay özniteliklerini ve formları HTML
 * ayrıştırma kuralıyla okur (WHATWG tokenizer'ın başlangıç etiketi ve
 * öznitelik durumları; yorumlar ve ham metin öğeleri atlanır).
 *
 * Önemli olan değerin sınırı: çift tırnaklı değer `"`'a, tek tırnaklı `'`'a,
 * tırnaksız değer boşluğa ya da `>`'a dek sürer - tırnaksız değerdeki `"`,
 * `'`, `=`, `<` ve `` ` `` tarayıcı için ayrıştırma hatasıdır ama değere
 * eklenir. Karakter referansları çözülür (`&quot;` → `"`): tarayıcı özeti
 * çözülmüş değerden hesaplar.
 */
function readBankMarkup(html: string): BankMarkup {
  const out: BankMarkup = { scripts: [], handlers: [], forms: [] };
  const lower = html.toLowerCase();
  const n = html.length;
  let i = 0;
  const isSpace = (c: string) =>
    c === " " || c === "\n" || c === "\t" || c === "\f";

  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    i = lt;
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    const next = html[i + 1] ?? "";
    if (next === "!" || next === "?" || next === "/") {
      const end = html.indexOf(">", i + 1);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (!/[a-z]/i.test(next)) {
      i += 1;
      continue;
    }

    // Etiket adı.
    let j = i + 1;
    while (j < n && !isSpace(html[j]) && html[j] !== "/" && html[j] !== ">") {
      j += 1;
    }
    const tag = lower.slice(i + 1, j);
    const attrs = new Map<string, string>();

    // Öznitelikler.
    while (j < n) {
      while (j < n && (isSpace(html[j]) || html[j] === "/")) j += 1;
      if (j >= n || html[j] === ">") break;
      const nameStart = j;
      // Adın ilk karakteri `=` olabilir (ayrıştırma hatası, adın parçası).
      j += 1;
      while (
        j < n &&
        !isSpace(html[j]) &&
        html[j] !== "/" &&
        html[j] !== ">" &&
        html[j] !== "="
      ) {
        j += 1;
      }
      const name = lower.slice(nameStart, j);
      let value = "";
      let k = j;
      while (k < n && isSpace(html[k])) k += 1;
      if (html[k] === "=") {
        k += 1;
        while (k < n && isSpace(html[k])) k += 1;
        const quote = html[k];
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, k + 1);
          const stop = close === -1 ? n : close;
          value = html.slice(k + 1, stop);
          j = close === -1 ? n : close + 1;
        } else {
          let end = k;
          while (end < n && !isSpace(html[end]) && html[end] !== ">") {
            end += 1;
          }
          value = html.slice(k, end);
          j = end;
        }
      }
      value = decodeEntities(value);
      // Tarayıcı aynı adı taşıyan ikinci özniteliği yok sayar.
      if (!attrs.has(name)) attrs.set(name, value);
    }
    i = j < n ? j + 1 : n;

    for (const [name, value] of attrs) {
      if (/^on[a-z]+$/.test(name)) out.handlers.push(value);
    }
    if (tag === "form") {
      out.forms.push({
        id: attrs.get("id") ?? "",
        action: attrs.get("action") ?? "",
      });
    }
    if (RAW_TEXT.has(tag)) {
      const close = findRawTextEnd(lower, tag, i);
      if (tag === "script") {
        out.scripts.push({
          src: attrs.has("src") ? (attrs.get("src") ?? "").trim() : null,
          body: html.slice(i, close.start),
        });
      }
      i = close.after;
    }
  }
  return out;
}

/** `</tag` + boşluk, `/` ya da `>` - ham metin öğesinin bittiği yer. */
function findRawTextEnd(
  lower: string,
  tag: string,
  from: number,
): { start: number; after: number } {
  let at = from;
  for (;;) {
    const start = lower.indexOf(`</${tag}`, at);
    if (start === -1) return { start: lower.length, after: lower.length };
    const c = lower[start + 2 + tag.length] ?? ">";
    if (
      c === ">" ||
      c === "/" ||
      c === " " ||
      c === "\n" ||
      c === "\t" ||
      c === "\f"
    ) {
      const gt = lower.indexOf(">", start);
      return { start, after: gt === -1 ? lower.length : gt + 1 };
    }
    at = start + 2;
  }
}

/** HTML karakter referanslarını çözer - olay özniteliği özeti için. */
function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi,
    (whole, ref: string) => {
      const name = ref.toLowerCase();
      if (name.startsWith("#x")) {
        return String.fromCodePoint(parseInt(name.slice(2), 16));
      }
      if (name.startsWith("#"))
        return String.fromCodePoint(Number(name.slice(1)));
      return (
        { quot: '"', apos: "'", amp: "&", lt: "<", gt: ">" }[name] ?? whole
      );
    },
  );
}
