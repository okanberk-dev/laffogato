import { APP_STORE_URL } from "@/lib/mobile/app-store";

import { AppStoreLinks } from "./app-links";

/**
 * The strip at the top of /masa/[code]: which table the guest is at, and how
 * to order to it. The page below it is the ordinary, view-only menu - the
 * site takes no cafe orders; a table orders from the app, prepaid
 * (docs/API-MOBILE.md §3, §22).
 *
 * On an iPhone with the app installed this page is rarely seen: the
 * association claims /masa/* (5 Kas 2026), so the camera hands the printed
 * card's URL to the app's masa/[kod] screen, which keeps the table for the
 * visit and opens the menu. What reaches this page is a guest without the
 * app (or on Android, whose app is not on Google Play yet): it says where
 * the order is placed, the store buttons below say where the app is, and the
 * staff line stays for whoever cannot use either.
 *
 * The sentences name the app's own words: Menü's round button is "Masadan
 * sipariş ver" (lafmobil `src/i18n/screens/table.ts`).
 *
 * `tableName` null means the code named no active table (unknown, retired or
 * rotated): the menu is still shown, with a neutral line instead of a name,
 * and nothing that would tell a guesser which of those it was.
 */
export function TableBanner({ tableName }: { tableName: string | null }) {
  const appLive = Boolean(APP_STORE_URL);
  return (
    <section className="table-banner" aria-label="Masa">
      <div className="wrap">
        <div className="table-banner-card">
          {tableName ? (
            <>
              <p className="table-banner-kicker">Hoş geldin</p>
              <h2 className="table-banner-title">Masa: {tableName}</h2>
              {appLive ? (
                <p className="table-banner-text">
                  Siparişini L’Affogato uygulamasından ver, ödemeni kartınla
                  yap; siparişin bu masaya gelir. Uygulama iPhone’unda yüklüyse
                  bu QR kodunu kamerayla okut, uygulama bu masayla açılır; ya da
                  uygulamada Menü’deki “Masadan sipariş ver”e dokun. Uygulaman
                  yoksa bir görevliye sorabilirsin.
                </p>
              ) : (
                <p className="table-banner-text">
                  Menü aşağıda; sipariş için bir görevliye sorabilirsin.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="table-banner-kicker">Menü</p>
              <h2 className="table-banner-title">Köşkün menüsü</h2>
              <p className="table-banner-text">
                Bu masa kodu şu an siparişe açık değil. Menüye göz atabilirsin;
                masaya sipariş için bir görevliye sorabilirsin.
              </p>
            </>
          )}
          <AppStoreLinks className="table-banner-links" />
        </div>
      </div>
    </section>
  );
}
