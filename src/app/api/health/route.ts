import { NextResponse } from "next/server";

import { dbHealth } from "@/lib/db";

/**
 * Hazır mı? - tek soru, tek cevap.
 *
 * Bu uç iki sessiz arızayı sese çeviriyor; ikisi de yaşandı:
 *
 * 1. **Deploy hiç çıkmıyordu.** 16-22 Eyl 2026 arasında `vercel.json`ın cron
 *    sayısı yüzünden üretime hiçbir şey çıkmadı ve kimse fark etmedi, çünkü
 *    site ayakta kalmaya devam etti: eski derlemeyi sunuyordu. Dışarıdan
 *    bakan hiçbir şey "yayımlanan sürüm eski" diyemiyordu.
 * 2. **Migration sessizce başarısız olabiliyor.** Şema `ensureSchemaFresh`
 *    ile her sorgudan önce kendini uyguluyor, ama o fonksiyon hatalarını
 *    BİLEREK yutuyor - yoksa erişilemeyen bir veritabanı, bakım modunun
 *    sınıflandıracağı sıradan bir sorgu hatası yerine 500 olurdu. Bedeli
 *    sessizlik: kendi sebebiyle düşen bir uygulama geriye yalnız kimsenin
 *    bakmadığı bir `console.warn` bırakıyor.
 *
 * `dbHealth()` migration'ı **tetikler** ve sonra sonucu söyler. Yani bir
 * deploy'dan sonra bu ucu bir kez çağırmak hem bekleyeni uygular hem de
 * uygulanıp uygulanmadığını bildirir.
 *
 * **Gövde bilerek kısır.** Sürüm, migration adı, sayı, hata metni yok -
 * hiçbiri dışarıdan birinin işine yaramamalı. `ok` false ise 503 döner, ki
 * bir izleyici (ya da Vercel'in kendi sağlık kontrolü) fark etsin.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await dbHealth();
  const ok = health.db === "up" && health.schema === "fresh";
  return NextResponse.json(
    { ok, ...health },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
