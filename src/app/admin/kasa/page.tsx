import { Card, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { TillConsole } from "./till-console";

export const metadata = { title: "Admin · Kasa · Damga" };
export const dynamic = "force-dynamic";

/**
 * Counter stamp desk.
 *
 * Gated on `till`, not on `orders`: this is the one page a cashier opens, and
 * the order list behind `orders` carries every customer's name, address and
 * phone - nothing a shift at the counter needs. The action behind the three
 * tabs opens the same gate again for itself.
 */
export default async function AdminTillPage() {
  await requireRole("till");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Kasa"
        title="Damga ekle"
        description="Üye ödedi ve uygulamadaki QR'ını gösterdi: çerçeveye tut, damga düşsün. Kamera açılmıyorsa kartındaki 8 karakterlik kodu, o da yoksa e-postasını kullan."
      />

      <TillConsole />

      <Card className="mt-4">
        <p className="text-xs leading-relaxed text-[var(--admin-text-mute)]">
          Her QR 2 dakika geçerlidir ve yalnız bir kez damga verir; ikinci
          okutma damga düşürmez. Uygulamadan verilen kafe siparişleri damgayı
          kendisi kazanır, burada tekrar verme. Yanlış damga verdiysen bir
          yöneticiye söyle: düzeltme yetkisi kasada değil.
        </p>
      </Card>
    </main>
  );
}
