# GELIVER — kargo entegrasyonu (webhook)

> **Tek yön:** Geliver bize haber verir, biz Geliver'i çağırmayız (henüz).
> Uygulamanın gösterdiği "Yola çıktı → Yolda → Teslim edildi" bu webhook'tan
> gelir; sözleşme `docs/API-MOBILE.md` §3.1, uygulama tarafı `lafmobil`
> `shipment-card.tsx`. Doğrulanmış kaynak: resmî SDK `@geliver/sdk` 1.3.0
> (github.com/GeliverApp/geliver-js) — her alan adı oradan okundu.

---

## 1. Kurulum — Geliver panelinde, tek webhook

| Alan | Değer |
|---|---|
| TYPE | `TRACK_UPDATED` |
| URL | **`https://laffogato.net/api/webhooks/geliver`** — apex, `www` DEĞİL |
| HEADER NAME | `x-geliver-signature` |
| HEADER VALUE | Vercel'deki `GELIVER_WEBHOOK_SECRET` ile **birebir aynı** |

**Neden apex:** kanonik host apex (22 Eyl 2026); `www.laffogato.net` her
isteğe **308** döner ve bir POST yönlendirmeyi izlemez — istek düşer, iki
tarafta da log yok, yalnız kargo durumları güncellenmeyi bırakır.

**Neden sabit başlık:** Geliver bugün gövdeyi **imzalamıyor**. SDK'daki
`verifyWebhookSignature()` bir yer tutucu — kapalıyken `true`, açıkken
`false` döner, yorumu "Future: HMAC(secret, timestamp + '.' + body)";
`x-signature` ve `x-timestamp` başlıkları buna ayrılmış. Tek kimlik, panelin
her teslimata eklediği sabit başlıktır. Uç onu sabit zamanlı karşılaştırır.
Gövde ham okunur; HMAC geldiği gün aynı baytlar üzerinden hesaplanır.

**Sunucu tarafı:** Vercel → Environment Variables → `GELIVER_WEBHOOK_SECRET`
(Production · Preview · Development), sonra **Redeploy** — ortam değişkeni
mevcut dağıtıma uygulanmaz. Yerel şablon: `.env.example`.

## 2. Gövde — gerçekte ne geliyor

```jsonc
{
  "event": "TRACK_UPDATED",
  "metadata": "…",                         // isteğe bağlı
  "data": {                                // Shipment
    "statusCode": "SHIPPED",               // CREATED … DELIVERED (aşağıda)
    "trackingNumber": "1234567890123",
    "trackingUrl": "https://…",            // taşıyıcı sayfası; yoksa yok
    "updatedAt": "2026-09-22T09:00:00Z",
    "providerCode": "SURAT",               // taşıyıcı kodu (bugün okunmuyor)
    "trackingStatus": {                    // Tracking — bir NESNE
      "trackingStatusCode": "IN_TRANSIT",
      "trackingSubStatusCode": "…",
      "statusDate": "2026-09-22T08:55:00Z",
      "test": false                        // "Test Et" → true
    }
  }
}
```

Okuyucu (`src/lib/mobile/geliver.ts`) önce bu şekli, sonra bir seviye zarfı
ve takma adları dener (`trackingCode`/`barcode`, `status`, `payload`…).
Eşleyemezse **200** döner ve alan ADLARINI günlüğe yazar — değerleri asla.

## 3. Durum eşlemesi

| Geliver `statusCode` | `shipment.status` | Üyenin gördüğü |
|---|---|---|
| `CREATED` · `GOT_OFFERS` · `OFFER_ACCEPTED` · `TRACKING_CODE_CREATED` · `LABEL_PRINTED` | `preparing` | Hazırlanıyor |
| `SHIPPED` | `shipped` | **Yola çıktı** |
| `TRACK_UPDATED` + `trackingStatus.trackingStatusCode` ≠ `DELIVERED` | `in_transit` | **Yolda** |
| `DELIVERED` | `delivered` | **Teslim edildi** |
| `RETURNED` · `RETURN_SHIPPED` | `returned` | Gönderi iade edildi |
| `CANCELED` (tek L!) · `FAILED` | `failed` | Gönderi teslim edilemedi |

Webhook `orders.status`u **hiç** oynatmaz — o köşkün makinesi, mağaza sahibi
sürer; paket iki gün `in_transit`ken sipariş `shipped`de durur.

## 4. Uç ne cevap verir

| Kod | Gövde | Anlamı |
|---|---|---|
| **503** | `{"error":"geliver_secret_unset"}` | Vercel'de secret yok ya da redeploy yapılmadı |
| **401** | `{"error":"unauthorized"}` | Header Value ≠ secret (ya da başlık yok) |
| **400** | `empty_body` · `invalid_json` · `invalid_body` | Bozuk teslimat; tekrar denemek fayda etmez, 400 logda görünür |
| **200** | `{"ok":true,"orderNo":284,"status":"in_transit"}` | Yazıldı |
| **200** | `{"ok":true,"test":true,"wouldApply":"…","written":false}` | "Test Et" — hiçbir şey yazılmadı |
| **200** | `{"ok":true,"ignored":"unknown_tracking_number"}` | Bu numarayı taşıyan sipariş yok |
| **200** | `{"ok":true,"ignored":"stale","orderNo":…}` | Satırdakinden eski olay (webhook'lar sıralı gelmez) |
| **200** | `{"ok":true,"ignored":"unmapped","fields":"…"}` | Şekil tanınmadı — `fields` alan adları |

## 5. Webhook'u API ile yönetmek (kendi makinenden)

Depoda **Geliver API anahtarı yoktur** ve olmamalıdır — bu taraf yalnız
dinler. Panel adresini değiştirmek için API'ye gerek yok; ama istersen resmî
API şu uçları verir (`https://api.geliver.io/api/v1`, `Authorization: Bearer
<panel API token>`):

```bash
# mevcut webhook'ları listele — URL www ise değiştirilmeli
curl -s https://api.geliver.io/api/v1/webhook -H "Authorization: Bearer $GELIVER_TOKEN"

# eskiyi sil, yenisini apex ile kur
curl -s -X DELETE "https://api.geliver.io/api/v1/webhook/<id>" -H "Authorization: Bearer $GELIVER_TOKEN"
curl -s -X POST https://api.geliver.io/api/v1/webhook -H "Authorization: Bearer $GELIVER_TOKEN" \
  -H "content-type: application/json" \
  -d '{"type":"TRACK_UPDATED","url":"https://laffogato.net/api/webhooks/geliver"}'

# panelin "Test Et" düğmesinin API karşılığı
curl -s -X PUT https://api.geliver.io/api/v1/webhook -H "Authorization: Bearer $GELIVER_TOKEN" \
  -H "content-type: application/json" \
  -d '{"type":"TRACK_UPDATED","url":"https://laffogato.net/api/webhooks/geliver"}'
```

`POST /webhook` gövdesinde başlık alanı görünmüyor (SDK `create({url, type})`);
`x-geliver-signature` başlığı panelden ekleniyorsa API ile kurulan webhook'ta
da paneldeki alanı doldurmayı unutma — yoksa uç **401** der.

## 6. Doğrulama — gönderi oluşturmadan

1. **Kendi makinenden, secret ile, uydurma numarayla:**
   ```bash
   curl -s -X POST https://laffogato.net/api/webhooks/geliver \
     -H "x-geliver-signature: $GELIVER_WEBHOOK_SECRET" -H "content-type: application/json" \
     -d '{"event":"TRACK_UPDATED","data":{"statusCode":"SHIPPED","trackingNumber":"DOGRULAMA-0000"}}'
   ```
   Beklenen: `{"ok":true,"ignored":"unknown_tracking_number"}` — kimlik, ayrıştırma
   ve veritabanı araması uçtan uca çalıştı, hiçbir sipariş dokunulmadı.
2. **Panelde "Test Et":** `{"ok":true,"test":true,…}` beklenir (Geliver
   `trackingStatus.test=true` gönderirse) ya da `unknown_tracking_number`.
3. **Vercel → Logs**, filtre `requestPath:/api/webhooks/geliver`:
   - **200** → doğru adres, doğru başlık.
   - **308** → istek `www`'ye gitmiş; paneldeki URL apex değil.
   - **401** → Header Value ≠ Vercel'deki secret.
   - **503** → secret Vercel'de yok / redeploy yapılmamış.
   - **400** → gövde boş ya da JSON değil; Geliver'in gönderdiği şekle bak.
   - **Hiç kayıt yok** → Geliver o URL'e hiç vurmamış: panelde webhook
     kayıtlı mı, tipi `TRACK_UPDATED` mı?
