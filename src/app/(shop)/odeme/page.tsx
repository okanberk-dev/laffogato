export const metadata = { title: "Ödeme" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Ödeme</h1>
      <p className="mt-2 text-neutral-600">
        Sanal POS sağlayıcısı seçildikten sonra burada checkout başlatılacak.
        Geliştirme sırasında MockPaymentProvider devrede.
      </p>
    </main>
  );
}
