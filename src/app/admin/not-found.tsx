import { Card, PageHeader } from "@/components/admin/forms";
import { PanelHomeLink } from "@/components/admin/panel-home";

/**
 * 404 inside the panel.
 *
 * `notFound()` is called on the record pages - a sipariş or a müşteri that no
 * longer exists - and without this file the answer was the SHOP's 404, with
 * "Menüyü gör" and "Mağazaya git" on it. An operator who followed a stale
 * link deserves to be told what happened and left inside the panel. A
 * mistyped or retired /admin address lands here too, through
 * admin/[...rest]/page.tsx (SHE-20).
 */
export default function AdminNotFound() {
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <PageHeader
        eyebrow="Panel · 404"
        title="Bu sayfa ya da kayıt bulunamadı."
        description="Silinmiş ya da başka bir sekmede değiştirilmiş olabilir. Bağlantı elle yazıldıysa adresi bir daha kontrol et."
      />
      <Card className="grid gap-4">
        <p className="text-sm text-[var(--admin-text-soft)]">
          Listeye dönmek için menüyü kullan - orada yalnız senin yetkinin açtığı
          bölümler var.
        </p>
        <PanelHomeLink className="inline-flex min-h-11 items-center justify-center justify-self-start rounded-lg bg-[var(--admin-primary)] px-5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] pointer-fine:min-h-9">
          Panele dön
        </PanelHomeLink>
      </Card>
    </main>
  );
}
