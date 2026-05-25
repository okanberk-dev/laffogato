import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
          Laffogato
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Her yudumda bir hikaye.
        </h1>
        <p className="text-base text-neutral-600">
          Kafemizin online vitrini hazırlanıyor. Yakında menüyü inceleyebilir,
          favori kahvelerinizi sipariş edebilirsiniz.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/urunler" className={cn(buttonVariants())}>
          Ürünleri Keşfet
        </Link>
        <Link
          href="/menu"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Menüye Bak
        </Link>
      </div>

      <p className="text-xs text-neutral-400">
        Bu sayfa geçici. Tasarım handoff geldiğinde gerçek anasayfaya
        dönüştürülecek.
      </p>
    </main>
  );
}
