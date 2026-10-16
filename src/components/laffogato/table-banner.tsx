import { AppStoreLinks } from "./app-links";

/**
 * The strip at the top of /masa/[code]: which table the guest is at, and that
 * ordering happens in the app. The page below it is the ordinary, view-only
 * menu - the site takes no cafe orders.
 *
 * `tableName` null means the code named no active table (unknown, retired or
 * rotated): the menu is still shown, with a neutral line instead of a name,
 * and nothing that would tell a guesser which of those it was.
 */
export function TableBanner({ tableName }: { tableName: string | null }) {
  return (
    <section className="table-banner" aria-label="Masa">
      <div className="wrap">
        <div className="table-banner-card">
          {tableName ? (
            <>
              <p className="table-banner-kicker">Hoş geldin</p>
              <h2 className="table-banner-title">Masa: {tableName}</h2>
              <p className="table-banner-text">
                Menü aşağıda. Siparişini L&apos;Affogato uygulamasından ver:
                masadaki QR&apos;ı uygulamayla okut, sipariş bu masaya gelsin.
                Ödeme sipariş verirken uygulamada alınır.
              </p>
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
