import { Card, PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";

import { TillConsole } from "./till-console";

export const metadata = { title: "Admin · Kasa · Damga" };
export const dynamic = "force-dynamic";

/**
 * Counter stamp desk.
 *
 * Gated on `till`, not on `orders`: this is the one page a cashier opens, and
 * the order list behind `orders` carries every customer's name, address and
 * phone - nothing a shift at the counter needs. The action behind the two
 * tabs opens the same gate again for itself.
 */
export default async function AdminTillPage() {
  await requireRole("till");

  return (
    <PageShell width="form">
      <PageHeader
        title="Kasa"
        description="Üye QR'ını gösterince çerçeveye tut, damga düşsün."
        help={
          <p>
            Üye ödedi ve uygulamadaki QR&apos;ını gösterdi: çerçeveye tut, damga
            düşsün. Kamera açılmıyorsa kartındaki 8 karakterlik kodu yaz.
            E-postayla damga verilmez.
          </p>
        }
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
    </PageShell>
  );
}
