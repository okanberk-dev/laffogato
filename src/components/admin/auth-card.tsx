import type { ReactNode } from "react";

import Link from "@/components/link";

import { AdminIcon } from "./ui/icons";

/**
 * The sign-in screens (giriş, iki adımlı doğrulama) in the panel's
 * StorageBox look (docs/ADMIN-STORAGEBOX.md), after Madame Coco Kenya's
 * own sign-in (operator, 21 Kas 2026: "giriş login sayfasını da estetik
 * yap ve mobil de uyumlu yap"). Inside the pale frame: the mark and the
 * name with "Siteye dön" on top, then two cards: the form on the left
 * (white card, pill fields, one blue button) and the köşk's night façade
 * on the right with a short line about the panel.
 *
 * On a phone and a tablet the photo is a short band above the form, so the
 * screen is not a bare form; from `lg` it is the tall card. Both are CSS
 * backgrounds of elements the other width hides (`display: none`), so a
 * screen downloads the photo once, at the size it shows. Server-safe.
 */
const PHOTO = "bg-[url(/photos/facade-night.webp)]";

const HIGHLIGHTS = ["Siparişler", "Karaoke", "Menü", "Raporlar"];

const TAGLINE = "Köşkün bütün işleri tek ekranda.";

/** The year on the köşk's clock (rule 22), for the footer. */
function istanbulYear(): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).format(new Date());
}

export function AuthCard({
  title,
  description,
  children,
  foot,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** A line under the form ("Şifreni unuttuysan …"). */
  foot?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh">
      <div className="admin-frame flex min-h-dvh w-full flex-col bg-[var(--admin-canvas)] lg:m-2 lg:min-h-[calc(100dvh-1rem)] lg:border lg:border-[var(--admin-frame-border)]">
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-7 lg:pt-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--admin-inverse)]"
            >
              <span className="brand-mark h-4" style={{ color: "#FFFFFF" }} />
            </span>
            <span className="admin-display truncate text-lg leading-none font-semibold tracking-[-0.03em] text-[var(--admin-text)]">
              L&apos;Affogato
              <span className="font-normal text-[var(--admin-text-mute)] max-sm:hidden">
                {" "}
                · Yönetim
              </span>
            </span>
          </span>
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-text-soft)] transition-colors hover:bg-[var(--admin-panel-hover)] hover:text-[var(--admin-text)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-ring)] focus-visible:outline-none sm:px-5"
          >
            Siteye dön
            <AdminIcon name="deltaUp" size={17} />
          </Link>
        </header>

        <div className="grid flex-1 content-start gap-4 px-4 pt-4 pb-4 sm:gap-5 sm:px-6 sm:pt-6 sm:pb-6 lg:grid-cols-12 lg:content-stretch lg:px-7 lg:pt-8 lg:pb-7">
          {/* Phone and tablet: a short band of the photo, the line on it. */}
          <div
            aria-hidden="true"
            className={`relative h-36 overflow-hidden rounded-xl bg-[#2a1a12] bg-cover bg-[center_38%] sm:h-44 lg:hidden ${PHOTO}`}
          >
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/5" />
            <p className="admin-display absolute inset-x-5 bottom-4 text-xl leading-tight font-normal text-balance text-white sm:inset-x-7 sm:bottom-6 sm:text-2xl">
              {TAGLINE}
            </p>
          </div>

          <section className="flex flex-col rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-surface)] px-5 py-7 sm:px-10 sm:py-10 lg:col-span-5">
            <div className="m-auto w-full max-w-[24rem]">
              <p className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--admin-panel)] px-3.5 text-[13px] text-[var(--admin-text-soft)]">
                <AdminIcon name="lock" size={14} />
                Yönetim paneli
              </p>
              <h1 className="admin-display mt-5 text-[length:var(--admin-h1)] leading-[1.15] font-normal text-[var(--admin-text)]">
                {title}
              </h1>
              <div className="mt-2 text-sm leading-6 break-words text-[var(--admin-text-soft)]">
                {description}
              </div>
              <div className="mt-7 sm:mt-8">{children}</div>
              {foot ? (
                <div className="mt-7 text-center text-sm leading-6 text-balance text-[var(--admin-text-mute)] sm:mt-8">
                  {foot}
                </div>
              ) : null}
            </div>
            <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--admin-text-mute)]">
              <span className="inline-flex items-center gap-1.5">
                <AdminIcon name="security" size={14} />
                Güvenli bağlantı
              </span>
              <span aria-hidden="true">·</span>
              <span>© {istanbulYear()} L&apos;Affogato · Tuzla</span>
            </footer>
          </section>

          <aside
            aria-label="L'Affogato, Tuzla"
            className={`relative hidden overflow-hidden rounded-xl bg-[#2a1a12] bg-cover bg-center lg:col-span-7 lg:block ${PHOTO}`}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/10"
            />
            <div className="relative flex h-full flex-col justify-between p-8 text-white xl:p-10">
              <span
                aria-hidden="true"
                className="brand-mark h-11 self-start"
                style={{ color: "#FFFFFF" }}
              />
              <div className="max-w-lg">
                <p className="admin-display text-[2rem] leading-[1.15] font-normal text-balance min-[90rem]:text-[2.5rem]">
                  {TAGLINE}
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                  Siparişleri ve karaoke rezervasyonlarını takip et, menüyü ve
                  mağazayı güncelle, günün rakamlarına bak.
                </p>
                <ul className="mt-6 flex flex-wrap gap-1">
                  {HIGHLIGHTS.map((item) => (
                    <li
                      key={item}
                      className="inline-flex h-10 items-center rounded-full bg-white/15 px-5 text-sm text-white backdrop-blur-md"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
