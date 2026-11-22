"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { accountMenuStateAction, logoutAction } from "@/app/uye/actions";
import Link from "@/components/link";
import { CONSENT_OPEN_EVENT } from "@/lib/consent/script";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";
import { OTHER_BRANCHES } from "@/lib/seo/branches";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/mobile/app-store";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";
import { addressLines } from "@/lib/utils/format";

import { LafMark } from "./brand-mark";
import { NewsletterForm } from "./newsletter-form";
import { ROUTE_PATHS, type Route } from "./route-paths";
import { cx } from "./cx";
import { useDialog } from "./use-dialog";
import { useOpenStatus } from "./use-open-status";

export type { Route };
/** Re-export for legacy importers that still pull `ROUTE_PATHS` from here.
    New server-side code should import directly from `./route-paths`. */
export { ROUTE_PATHS };

/*
 * The site's chrome, in the reference's language (bluebottlecoffee.com,
 * measured 22 Kas 2026): the announcement line and the bar ride together
 * at the top and slide away while the page scrolls down, back as soon as it
 * scrolls up. The bar: the destinations on the left in tracked capitals
 * (underlined under the pointer, the open one heavier), the mark in the
 * middle, search, account and bag on the right, all on the band. A
 * destination with more behind it opens a full-width panel under the bar:
 * its columns of links, then a row of pictures. Below the wide layout the
 * menu button takes the left and opens a sheet with the same destinations,
 * one level at a time, and the pictures under them; on a phone a row of
 * pills follows the bar and scrolls with the page. The account opens a
 * drawer from the right. The footer is the charcoal block.
 */

export interface DropdownEntry {
  slug: string;
  label: string;
  sub: string;
}

/** Every /menu/<slug> page has a door in the chrome, built from the real
 *  category routes so an entry cannot point at a page that does not exist. */
const MENU_LINKS: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => c.nav,
).map((c) => ({ slug: c.slug, label: c.nav!.label, sub: c.nav!.italian }));
const MENU_MORE: DropdownEntry[] = MENU_CATEGORY_ROUTES.filter(
  (c) => !c.nav,
).map((c) => ({ slug: c.slug, label: c.breadcrumbLabel, sub: "" }));

const SHOP_LINKS: DropdownEntry[] = [
  { slug: "cekirdek", label: "Çekirdek kahve", sub: "Bologna'da kavrulur" },
  { slug: "hediye", label: "Hediye setleri", sub: "Kutusunda hazır" },
  { slug: "ekipman", label: "Ekipman", sub: "Moka pot, chasen" },
  { slug: "giyim", label: "Giyim", sub: "Önlük, tişört" },
  { slug: "kiler", label: "Kiler", sub: "Matcha, şurup" },
];

type DropdownKey = "menu" | "shop" | "visit";

interface LinkEntry {
  href: string;
  label: string;
  /** SPA section this link opens, when it is one. */
  route?: Route;
  dropdown?: DropdownKey;
}

const LINKS: LinkEntry[] = [
  { href: "/menu", label: "Menü", route: "menu", dropdown: "menu" },
  { href: "/magaza", label: "Mağaza", route: "shop", dropdown: "shop" },
  { href: "/karaoke", label: "Karaoke" },
  {
    href: "/ziyaret",
    label: "Ziyaret & keşfet",
    route: "visit",
    dropdown: "visit",
  },
];

interface PanelLink {
  href: string;
  label: string;
}

/** A column of a panel: its heading (a door of its own when it has a
 *  page), then its links. */
interface PanelGroup {
  title: string;
  href?: string;
  links: PanelLink[];
}

const VISIT_PLACES: PanelLink[] = [
  { href: "/ziyaret", label: "Tuzla köşkü" },
  ...OTHER_BRANCHES.map((b) => ({ href: `/ziyaret#${b.id}`, label: b.name })),
];
const VISIT_LEARN: PanelLink[] = [
  { href: "/hikayemiz", label: "Hikayemiz" },
  { href: "/kampanyalar", label: "Kampanyalar" },
  { href: "/rehber", label: "Rehber" },
  { href: "/franchise", label: "Franchise" },
];

const PANEL_GROUPS: Record<DropdownKey, PanelGroup[]> = {
  menu: [
    {
      title: "Tüm menü",
      href: "/menu",
      links: MENU_LINKS.map((m) => ({
        href: `/menu/${m.slug}`,
        label: m.label,
      })),
    },
    {
      title: "Diğer",
      links: MENU_MORE.map((m) => ({
        href: `/menu/${m.slug}`,
        label: m.label,
      })),
    },
  ],
  shop: [
    {
      title: "Tüm mağaza",
      href: "/magaza",
      links: SHOP_LINKS.map((s) => ({
        href: `/magaza/${s.slug}`,
        label: s.label,
      })),
    },
  ],
  visit: [
    { title: "Ziyaret", href: "/ziyaret", links: VISIT_PLACES },
    { title: "Keşfet", links: VISIT_LEARN },
  ],
};

/** The way back to a panel's whole section, first in the phone's level. */
const ALL_LABEL: Record<DropdownKey, { href: string; label: string }> = {
  menu: { href: "/menu", label: "Tüm menü" },
  shop: { href: "/magaza", label: "Tüm mağaza" },
  visit: { href: "/ziyaret", label: "Ziyaret" },
};

/** The row of pictures under every panel and in the phone's sheet: the
 *  same four everywhere, as the reference shows its four. Real pages and
 *  the site's own photographs. */
const HIGHLIGHTS: Array<{ href: string; title: string; src: string }> = [
  {
    href: "/menu/matcha",
    title: "Matcha Bar",
    src: "/menu/matcha-latte.webp",
  },
  {
    href: "/magaza",
    title: "Evde L'Affogato",
    src: "/photos/hero-shop.webp",
  },
  {
    href: "/karaoke",
    title: "Karaoke odası",
    src: "/photos/hero-karaoke.webp",
  },
  {
    href: "/ziyaret",
    title: "Tuzla köşkü",
    src: "/photos/facade-day.webp",
  },
];

/** The pills under the bar on a phone (the reference's row of pills). */
const QUICK_LINKS = [
  { href: "/menu", label: "Menü" },
  { href: "/karaoke", label: "Karaoke" },
  { href: "/magaza", label: "Mağaza" },
  { href: "/kampanyalar", label: "Kampanyalar" },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavProps {
  /** Current SPA route. Kept for the SPA's callers; the active link is
      worked out from the URL, so pages outside the SPA light up too. */
  route?: Route;
  /** SPA-internal navigate. When undefined, links are plain anchors. */
  navigate?: (r: Route) => void;
  cart?: number;
  onCart?: () => void;
  onSearch?: () => void;
}

export function Nav({ navigate, cart, onCart, onSearch }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  // The panel last opened: it stays drawn while it fades out.
  const [shownPanel, setShownPanel] = useState<DropdownKey | null>(null);
  if (openDropdown && openDropdown !== shownPanel) setShownPanel(openDropdown);
  const caretRefs = useRef<Partial<Record<DropdownKey, HTMLButtonElement>>>({});
  const [mobileSection, setMobileSection] = useState<DropdownKey | null>(null);
  const levelTriggerRefs = useRef<
    Partial<Record<DropdownKey, HTMLButtonElement>>
  >({});
  const backRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // Scrolled down past the chrome: it slides up out of the way.
  const [tucked, setTucked] = useState(false);

  // A new page closes whatever the last one left open (adjusted during
  // render when the URL changes, not in an effect).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
    setOpenDropdown(null);
    setMobileSection(null);
  }

  // The reference's top: down the page it goes, up the page it comes back.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) < 6) return;
        last = y;
        const height = topRef.current?.offsetHeight ?? 0;
        setTucked(delta > 0 && y > height);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const burgerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    document.body.classList.toggle("is-no-scroll", open);
    if (!open) return;
    // The sheet opens right under the bar, wherever the bar is: under the
    // announcement line at the top of the page and after scrolling back up.
    const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
    sheetRef.current?.style.setProperty(
      "--sheet-top",
      `${Math.max(0, bottom)}px`,
    );
    // The page behind the sheet is out of reach while it is open: Tab goes
    // from the last link back to the bar, not into the hidden page.
    const behind = [
      document.querySelector<HTMLElement>(".nav-quick"),
      document.getElementById("main"),
      document.querySelector<HTMLElement>(".site-footer"),
    ].filter((el): el is HTMLElement => el !== null);
    behind.forEach((el) => el.setAttribute("inert", ""));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      behind.forEach((el) => el.removeAttribute("inert"));
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Back to the control that opened it, so the keyboard is not lost.
      caretRefs.current[openDropdown]?.focus();
      setOpenDropdown(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [openDropdown]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const go =
    (link: { href: string; route?: Route }) => (e: React.MouseEvent) => {
      setOpen(false);
      setOpenDropdown(null);
      setMobileSection(null);
      if (navigate && link.route) {
        e.preventDefault();
        navigate(link.route);
      }
    };

  const onHoverOpen = (key: DropdownKey) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setOpenDropdown(key);
  };
  const onHoverClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpenDropdown(null), 180);
  };

  // The phone's levels: into one, focus on its way back; out of it, focus
  // on the row that opened it.
  const openLevel = (key: DropdownKey) => {
    setMobileSection(key);
    requestAnimationFrame(() => backRef.current?.focus());
  };
  const closeLevel = () => {
    const key = mobileSection;
    setMobileSection(null);
    requestAnimationFrame(() => {
      if (key) levelTriggerRefs.current[key]?.focus();
    });
  };
  const toggleSheet = () => {
    setOpen((v) => !v);
    setMobileSection(null);
  };

  const cartCount = cart ?? 0;
  const openCart = () => {
    setOpen(false);
    if (onCart) onCart();
    // A full page load, never a client-side one: the checkout must open in
    // a document of its own, under its own policy and without the tags this
    // page has already run (src/lib/security/checkout-document.ts).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the point
    else window.location.assign("/odeme");
  };
  const openSearch = () => {
    setOpen(false);
    if (onSearch) onSearch();
    else router.push("/magaza?ara=1");
  };

  // ⌘K / Ctrl+K anywhere, and "/" when the visitor is not typing.
  const openSearchRef = useRef(openSearch);
  useEffect(() => {
    openSearchRef.current = openSearch;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !typing && !e.metaKey && !e.ctrlKey;
      if (!combo && !slash) return;
      if (document.querySelector(".search-overlay")) return;
      e.preventDefault();
      openSearchRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const home = { href: "/", route: "home" as Route };
  // Never tucked away while something in it is open.
  const hidden = tucked && !open && !openDropdown;

  return (
    <>
      <div className={cx("site-top", hidden && "is-tucked")} ref={topRef}>
        <div className="announce">
          <p className="t-micro">
            Uygulamadan siparişte damga topla <span aria-hidden="true">|</span>{" "}
            <Link href="/kampanyalar" className="announce-link">
              Kampanyalar
            </Link>
          </p>
        </div>
        <header
          className={cx("site-header", open && "is-sheet-open")}
          ref={headerRef}
          onMouseLeave={onHoverClose}
          onBlur={(e) => {
            // Tabbing out of the header folds the panel away.
            const next = e.relatedTarget as Node | null;
            if (openDropdown && next && !e.currentTarget.contains(next))
              setOpenDropdown(null);
          }}
        >
          <div className="nav">
            <button
              type="button"
              ref={burgerRef}
              className="icon-btn nav-burger"
              aria-expanded={open}
              aria-controls="mobile-sheet"
              aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
              onClick={toggleSheet}
            >
              {open ? <CloseGlyph /> : <BurgerGlyph />}
            </button>

            <nav className="nav-links" aria-label="Ana menü">
              <ul role="list">
                {LINKS.map((l) => {
                  const active = isActivePath(pathname, l.href);
                  const isOpen = l.dropdown && openDropdown === l.dropdown;
                  return (
                    <li
                      key={l.href}
                      className="nav-link-wrap"
                      onMouseEnter={
                        l.dropdown
                          ? () => onHoverOpen(l.dropdown!)
                          : () => setOpenDropdown(null)
                      }
                    >
                      <a
                        href={l.href}
                        onClick={go(l)}
                        className={cx("nav-link", isOpen && "is-open")}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="t-nav nav-link-text">{l.label}</span>
                      </a>
                      {l.dropdown ? (
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) caretRefs.current[l.dropdown!] = el;
                          }}
                          className="nav-caret"
                          aria-expanded={!!isOpen}
                          aria-controls="nav-panel"
                          aria-label={`${l.label} alt menüsü`}
                          onClick={() => {
                            if (isOpen) {
                              setOpenDropdown(null);
                              return;
                            }
                            setOpenDropdown(l.dropdown!);
                            // Into the panel it opened, not on to the next
                            // link: the panel sits later in the bar's order.
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLElement>("#nav-panel a")
                                ?.focus(),
                            );
                          }}
                        >
                          <ChevronGlyph />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <a
              href={home.href}
              onClick={go(home)}
              onMouseEnter={() => setOpenDropdown(null)}
              className="nav-brand"
              aria-label="L'Affogato ana sayfa"
            >
              <LafMark tone="duo" />
            </a>

            <div
              className="nav-tools"
              onMouseEnter={() => setOpenDropdown(null)}
            >
              <button
                type="button"
                className="icon-btn"
                onClick={openSearch}
                aria-label="Ara"
              >
                <SearchGlyph />
              </button>
              <AccountMenu />
              <button
                type="button"
                className="icon-btn nav-cart"
                onClick={openCart}
                aria-label={
                  cartCount > 0 ? `Sepet, ${cartCount} ürün` : "Sepet, boş"
                }
              >
                <BagGlyph />
                {cartCount > 0 ? (
                  <span className="nav-cart-count tabular" aria-hidden="true">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* The panel under the bar. It stays mounted so the hover can move
              from the link into it and it can fade out; inert while
              closed. */}
          <div
            id="nav-panel"
            className={cx("nav-panel", openDropdown && "open")}
            inert={!openDropdown}
            onMouseEnter={() => {
              if (closeTimerRef.current)
                window.clearTimeout(closeTimerRef.current);
            }}
          >
            {shownPanel ? (
              <NavPanel
                panel={shownPanel}
                onPick={() => setOpenDropdown(null)}
              />
            ) : null}
          </div>
        </header>
      </div>

      {/* The pills: a phone's row under the bar, scrolling with the page. */}
      <nav className="nav-quick" aria-label="Hızlı bağlantılar">
        <ul role="list">
          {QUICK_LINKS.map((q) => (
            <li key={q.href}>
              <Link
                href={q.href}
                className="chip nav-quick-chip"
                aria-current={
                  isActivePath(pathname, q.href) ? "page" : undefined
                }
              >
                <span className="nav-quick-text">{q.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* The menu below the wide layout: a sheet under the bar, one level
          at a time. */}
      <div
        id="mobile-sheet"
        ref={sheetRef}
        className={cx("mobile-sheet", open && "open")}
        inert={!open}
        aria-hidden={open ? undefined : true}
      >
        <nav aria-label="Mobil menü" className="sheet-nav">
          {mobileSection === null ? (
            <>
              <ul className="sheet-list" role="list">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    {l.dropdown ? (
                      <button
                        type="button"
                        className="sheet-row"
                        ref={(el) => {
                          if (el) levelTriggerRefs.current[l.dropdown!] = el;
                        }}
                        onClick={() => openLevel(l.dropdown!)}
                      >
                        <span className="t-nav sheet-row-text">{l.label}</span>
                      </button>
                    ) : (
                      <a
                        href={l.href}
                        onClick={go(l)}
                        className="sheet-row"
                        aria-current={
                          isActivePath(pathname, l.href) ? "page" : undefined
                        }
                      >
                        <span className="t-nav sheet-row-text">{l.label}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <HighlightCards
                className="sheet-cards"
                onPick={() => setOpen(false)}
              />
            </>
          ) : (
            <div id="sheet-level" className="sheet-level">
              <button
                type="button"
                ref={backRef}
                className="sheet-row sheet-back"
                onClick={closeLevel}
              >
                <ArrowBackGlyph />
                <span className="t-nav sheet-row-text">Ana menüye dön</span>
              </button>
              <ul
                className="sheet-list"
                role="list"
                aria-label={
                  LINKS.find((l) => l.dropdown === mobileSection)?.label
                }
              >
                <li>
                  <a
                    href={ALL_LABEL[mobileSection].href}
                    className="sheet-row"
                    onClick={go({
                      href: ALL_LABEL[mobileSection].href,
                      route: LINKS.find((l) => l.dropdown === mobileSection)
                        ?.route,
                    })}
                  >
                    <span className="t-nav sheet-row-text">
                      {ALL_LABEL[mobileSection].label}
                    </span>
                  </a>
                </li>
                {panelLinks(mobileSection)
                  .filter((e) => e.href !== ALL_LABEL[mobileSection].href)
                  .map((e) => (
                    <li key={e.href}>
                      <a
                        href={e.href}
                        className="sheet-row"
                        onClick={() => {
                          setOpen(false);
                          setMobileSection(null);
                        }}
                      >
                        <span className="t-nav sheet-row-text">{e.label}</span>
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </nav>
        <ul className="sheet-account" role="list">
          <li>
            <a href="/uye/hesap" onClick={() => setOpen(false)}>
              Hesabım
            </a>
          </li>
          <li>
            <Link href="/uye/hesap/siparislerim" onClick={() => setOpen(false)}>
              Siparişlerim
            </Link>
          </li>
          {APP_STORE_URL ? (
            <li>
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                Uygulamayı indir
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </>
  );
}

/** A panel's links, in its columns' order (the phone's level lists them). */
function panelLinks(key: DropdownKey): PanelLink[] {
  return PANEL_GROUPS[key].flatMap((g) =>
    g.href ? [{ href: g.href, label: g.title }, ...g.links] : g.links,
  );
}

function NavPanel({
  panel,
  onPick,
}: {
  panel: DropdownKey;
  onPick: () => void;
}) {
  return (
    <div className="nav-panel-inner">
      <ul className="nav-panel-cols" role="list">
        {PANEL_GROUPS[panel].map((g) => (
          <li key={g.title} className="nav-panel-col">
            {g.href ? (
              <a href={g.href} className="nav-panel-head" onClick={onPick}>
                <span className="nav-panel-head-text">{g.title}</span>
              </a>
            ) : (
              <span className="nav-panel-head">
                <span className="nav-panel-head-text">{g.title}</span>
              </span>
            )}
            <ul className="nav-panel-list" role="list">
              {g.links.map((e) => (
                <li key={e.href}>
                  <a href={e.href} onClick={onPick}>
                    <span className="nav-panel-link-text">{e.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <HighlightCards className="nav-panel-cards" onPick={onPick} />
    </div>
  );
}

/** The reference's row of pictures: a photograph and its name, the name
 *  underlined under the pointer. */
function HighlightCards({
  className,
  onPick,
}: {
  className: string;
  onPick: () => void;
}) {
  return (
    <ul className={cx("highlight-cards", className)} role="list">
      {HIGHLIGHTS.map((h) => (
        <li key={h.href}>
          <a href={h.href} className="highlight-card" onClick={onPick}>
            <span className="highlight-card-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.src} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="highlight-card-title">{h.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The account: the person button opens a drawer from the right, as the
 * reference's does - its name in large capitals, then the way in, or, for
 * a member, the way to their pages and out.
 */
function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{
    signedIn: boolean;
    firstName: string;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const close = () => setOpen(false);

  // Escape, focus in and back, Tab kept inside, the page behind locked.
  useDialog(open, close, panelRef);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === null) {
      accountMenuStateAction()
        .then(setState)
        .catch(() => setState({ signedIn: false, firstName: "" }));
    }
  };

  const title =
    state === null
      ? "Hesap"
      : state.signedIn
        ? state.firstName
          ? `Merhaba ${state.firstName}`
          : "Hesabın"
        : "Giriş yap ya da hesap aç";

  return (
    <div className="nav-account">
      <button
        type="button"
        className="icon-btn"
        aria-label="Hesap menüsü"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <PersonGlyph />
      </button>
      {open
        ? createPortal(
            <div className="account-layer">
              <div
                className="account-scrim"
                aria-hidden="true"
                onClick={close}
              />
              <div
                className="account-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-drawer-title"
                ref={panelRef}
                tabIndex={-1}
              >
                <div className="account-drawer-top">
                  <button
                    type="button"
                    className="account-drawer-close"
                    onClick={close}
                  >
                    <span>Kapat</span>
                    <CloseGlyph />
                  </button>
                </div>
                <div className="account-drawer-body">
                  <h2
                    id="account-drawer-title"
                    className="account-drawer-title"
                  >
                    {title}
                  </h2>
                  {state === null ? (
                    <p className="account-drawer-text" aria-live="polite">
                      …
                    </p>
                  ) : state.signedIn ? (
                    <>
                      <ul className="account-drawer-links" role="list">
                        <li>
                          <Link href="/uye/hesap" onClick={close}>
                            Hesabım
                          </Link>
                        </li>
                        <li>
                          <Link href="/uye/hesap/siparislerim" onClick={close}>
                            Siparişlerim
                          </Link>
                        </li>
                      </ul>
                      <form action={logoutAction}>
                        <button type="submit" className="btn btn-block">
                          Çıkış yap
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <p className="account-drawer-text">
                        Sipariş geçmişin, adreslerin ve favorilerin hesabında.
                      </p>
                      <div className="account-drawer-actions">
                        <Link
                          href="/uye/giris"
                          className="btn btn-dark btn-block"
                          onClick={close}
                        >
                          Giriş yap
                        </Link>
                        <Link
                          href="/uye/kayit"
                          className="btn btn-block"
                          onClick={close}
                        >
                          Üye ol
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function BurgerGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2 4.5h16M2 9.5h16M2 14.5h16"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2 2l16 16M18 2 2 18" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function ArrowBackGlyph() {
  return (
    <svg
      className="sheet-back-arrow"
      viewBox="0 0 28 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M28 6H2M7 1 2 6l5 5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 8"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="m15.5 15.5 6 6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 23c.6-5 4.4-8.5 9.5-8.5s8.9 3.5 9.5 8.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function BagGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 9h17l-1.4 13H4.9L3.5 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 11V6.5a4 4 0 0 1 8 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Footer - the charcoal block, as the reference's: the mark, the link
   columns and the letter side by side, then who runs the site and the
   bottom line.
   ───────────────────────────────────────────────────────────── */

export interface FooterSettings {
  phone?: string;
  email?: string;
  address?: string;
  /** Ayarlar → Saatler as label/value rows (`footerSettings`, seo/contact.ts). */
  hours?: [string, string][];
  /** Courier fee in kuruş, from /admin/ayarlar. */
  courierFeeMinor?: number;
  /** Mobil → Ayarlar → Kurye (`mobileApp.ordering.deliveryEnabled`). */
  courierEnabled?: boolean;
  /** Ayarlar → "Gel-al hazırlık süresi", for the home page's order card. */
  pickupReadyMinutes?: number;
  /** Stamps per free drink (`mobileApp.loyalty.stampTarget`). */
  stampTarget?: number;
  /** Ayarlar → Vergi, the day the menu prices started ("YYYY-MM-DD" or ""). */
  menuPricesEffectiveDate?: string;
}

interface FooterProps {
  /** Optional SPA navigate - when provided, links call it (no full nav).
      When absent (non-SPA pages), links are plain anchors to real routes. */
  navigate?: (r: Route) => void;
  settings?: FooterSettings;
}

const DEFAULT_ADDRESS_LINES = [
  "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
  "34940 Tuzla / İstanbul",
];

/** The bundled week, for a page that passes no settings (error pages). */
const DEFAULT_HOURS: [string, string][] = [
  [
    "Her gün",
    `${LEGAL_ENTITY.cafeHours.opens} - ${LEGAL_ENTITY.cafeHours.closes}`,
  ],
];

/** The registered seat: the tax certificate's address, one line. */
const COMPANY_ADDRESS = `${LEGAL_ENTITY.address.line1}, ${LEGAL_ENTITY.address.postalCode} ${LEGAL_ENTITY.address.district} / ${LEGAL_ENTITY.address.city}`;

/** The legal person on the tax certificate. */
const SITE_LEGAL_NAME = `${SITE.name} - ${LEGAL_ENTITY.shortName}`;

export function Footer({ navigate, settings }: FooterProps) {
  const hrefFor = (r: Route) => ROUTE_PATHS[r];
  const go = (r: Route) => (e: React.MouseEvent) => {
    if (!navigate) return; // allow default anchor navigation
    e.preventDefault();
    navigate(r);
    window.scrollTo({ top: 0 });
  };
  // `||`, not `??`: a field cleared in the panel arrives as "".
  const phone = settings?.phone?.trim() || SITE.phone;
  const tel = phone.replace(/[^\d+]/g, "") || SITE.phoneE164;
  const email = settings?.email?.trim() || SITE.email;
  const lines = addressLines(settings?.address ?? "", DEFAULT_ADDRESS_LINES);
  const hours = settings?.hours?.length ? settings.hours : DEFAULT_HOURS;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" data-ground="dark">
      <Link href="/" className="footer-brand" aria-label="L'Affogato ana sayfa">
        <LafMark tone="cream" />
        <span className="footer-wordmark">L&apos;Affogato</span>
      </Link>

      <div className="footer-main">
        <nav className="footer-cols" aria-label="Site haritası">
          <FooterColumn title="Keşfet">
            <li>
              <a href={hrefFor("menu")} onClick={go("menu")}>
                Menü
              </a>
            </li>
            <li>
              <a href={hrefFor("shop")} onClick={go("shop")}>
                Mağaza
              </a>
            </li>
            <li>
              <a href="/kampanyalar">Kampanyalar</a>
            </li>
            <li>
              <a href="/karaoke">Karaoke odası</a>
            </li>
            <li>
              <a href={hrefFor("story")} onClick={go("story")}>
                Hikayemiz
              </a>
            </li>
            <li>
              <Link href="/rehber">Rehber</Link>
            </li>
          </FooterColumn>
          <FooterColumn title="Ziyaret" wide>
            <li>
              <a href={hrefFor("visit")} onClick={go("visit")}>
                Tuzla köşkü
              </a>
            </li>
            <li className="footer-note">{lines.join(", ")}</li>
            {/* Ayarlar → Saatler: one row for a uniform week. */}
            {hours.map(([label, value], i) => (
              <li key={i} className="footer-note tabular">
                {label} {value}
              </li>
            ))}
            <li className="footer-note-live">
              <KoskStatus hours={hours} />
            </li>
            <li>
              <a href={`tel:${tel}`} className="tabular">
                {phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`}>{email}</a>
            </li>
            {OTHER_BRANCHES.map((b) => (
              <li key={b.id}>
                <a href={`/ziyaret#${b.id}`}>{b.name}</a>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Üyelik">
            {APP_STORE_URL ? (
              <li>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  iPhone için App Store
                </a>
              </li>
            ) : null}
            {PLAY_STORE_URL ? (
              <li>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Android için Google Play
                </a>
              </li>
            ) : null}
            <li>
              <a href="/uye/hesap">Üyelik ve ödüller</a>
            </li>
            <li>
              <a href="/uye/kayit">Üye ol</a>
            </li>
            <li>
              <a href="/uye/giris">Giriş yap</a>
            </li>
          </FooterColumn>
          {/* Seven documents; the criterion for each is in
              src/lib/legal/nav.ts. The rest are one click away, in the
              bottom line. */}
          <FooterColumn title="Kurumsal">
            <li>
              <Link href="/franchise">Franchise</Link>
            </li>
            {FOOTER_LEGAL_DOCS.map((d) => (
              <li key={d.slug}>
                <Link href={`/hukuk/${d.slug}`}>{d.label}</Link>
              </li>
            ))}
          </FooterColumn>
        </nav>

        {/* The monthly letter: 6563 consent records behind it. */}
        <div className="footer-letter">
          <h2 className="footer-heading">Bültene abone ol</h2>
          <p className="footer-letter-text">
            Yeni sezon affogatoları, kavurma notları, küçük gelato denemeleri.
            Hiçbir zaman ayda birden fazla.
          </p>
          <NewsletterForm />
          <ul className="footer-social" role="list">
            <li>
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <SocialGlyph network="instagram" />
              </a>
            </li>
            <li>
              <a
                href={SITE.social.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <SocialGlyph network="tiktok" />
              </a>
            </li>
            <li>
              <a
                href={SITE.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <SocialGlyph network="youtube" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Every category page keeps a door in the footer. */}
      <div className="footer-cats">
        <p>
          <span className="footer-cats-label">Menüde</span>{" "}
          {[...MENU_LINKS, ...MENU_MORE].map((m, i) => (
            <span key={m.slug}>
              {i > 0 ? " · " : ""}
              <a href={`/menu/${m.slug}`}>{m.label}</a>
            </span>
          ))}
        </p>
        <p>
          <span className="footer-cats-label">Mağazada</span>{" "}
          {SHOP_LINKS.map((s, i) => (
            <span key={s.slug}>
              {i > 0 ? " · " : ""}
              <a href={`/magaza/${s.slug}`}>{s.label}</a>
            </span>
          ))}
        </p>
      </div>

      {/* Who runs the site and where it can be reached directly (ETHS
          Yön. m.5/1, 6563 m.3/1), straight from LEGAL_ENTITY. */}
      <dl className="footer-company">
        <div>
          <dt>Ticaret unvanı</dt>
          <dd>{LEGAL_ENTITY.legalName}</dd>
        </div>
        <div>
          <dt>MERSİS</dt>
          <dd className="tabular">{LEGAL_ENTITY.mersisNo}</dd>
        </div>
        <div>
          <dt>Merkez</dt>
          <dd>{COMPANY_ADDRESS}</dd>
        </div>
        {LEGAL_ENTITY.kep ? (
          <div>
            <dt>KEP</dt>
            <dd>{LEGAL_ENTITY.kep}</dd>
          </div>
        ) : null}
        <div>
          <dt>Ödeme</dt>
          <dd>Visa · Mastercard · Troy</dd>
        </div>
      </dl>

      <div className="footer-bottom">
        <ul className="footer-legal" role="list">
          <li>
            <button
              type="button"
              className="footer-linkish"
              onClick={() =>
                window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
              }
            >
              Çerez tercihleri
            </button>
          </li>
          <li>
            <Link href="/hukuk">Tüm belgeler</Link>
          </li>
          <li>
            <Link href="/hukuk/sirket-bilgileri">Şirket bilgileri</Link>
          </li>
          <li>
            {/* Every shell names its <main> "main". */}
            <a href="#main">Başa dön</a>
          </li>
        </ul>
        {/* The year is read on the server and in the browser; on the night
            of 31 December the two differ, which must not fail hydration. */}
        <span className="footer-copy" suppressHydrationWarning>
          © {year} {SITE_LEGAL_NAME}
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  wide,
  children,
}: {
  title: string;
  /** The column whose lines are sentences (an address): it may wrap
      wider than the others. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("footer-col", wide && "footer-col--wide")}>
      <h2 className="footer-heading footer-col-title">{title}</h2>
      <ul className="footer-col-list" role="list">
        {children}
      </ul>
    </div>
  );
}

/**
 * Whether the köşk is open now, once the browser has answered: the same
 * `useOpenStatus` the home page and /ziyaret read, so the three never
 * disagree. Nothing live is printed on the server.
 */
function KoskStatus({
  hours,
}: {
  hours: ReadonlyArray<readonly [string, string]>;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  return (
    <span className={cx("open-line", st.open ? "is-open" : "is-closed")}>
      {st.open ? "Şu an açık" : "Şu an kapalı"}
    </span>
  );
}

/** Plain line glyphs, not the networks' artwork. */
function SocialGlyph({
  network,
}: {
  network: "instagram" | "tiktok" | "youtube";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {network === "instagram" ? (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
        </>
      ) : network === "tiktok" ? (
        <path d="M14 3.5v11.25a3.75 3.75 0 1 1-3.75-3.75M14 3.5c.4 2.6 2.2 4.3 5 4.6" />
      ) : (
        <>
          <rect x="2.75" y="5.5" width="18.5" height="13" rx="4" />
          <path d="m10.25 9.25 4.5 2.75-4.5 2.75Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
