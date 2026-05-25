import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Hesabım" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/hesabim");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Hesabım</h1>
      <p className="mt-2 text-neutral-600">Merhaba {user.email}.</p>
      <p className="mt-1 text-neutral-500">
        Sipariş geçmişi, adresler ve profil ayarları yakında.
      </p>
    </main>
  );
}
