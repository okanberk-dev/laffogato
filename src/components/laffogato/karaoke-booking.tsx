"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react";

import {
  bookKaraokeAction,
  type BookKaraokeState,
} from "@/app/karaoke/actions";
import { BusyDots } from "./busy-dots";
import { Illustration } from "./illustration";
import { kdvIncludedParts, type KdvIncludedParts } from "./kdv-note";
import { karaokeBookingTerms } from "./karaoke-terms";
import { hourToLabel } from "./karaoke-today";
import {
  KARAOKE_DRAFT_KEY,
  KARAOKE_STEP_LABELS,
  karaokeBackIsHistory,
  karaokeBlockIsFree,
  karaokeBookingInit,
  karaokeBookingReducer,
  karaokeDraftFromJson,
  karaokeDraftToJson,
  karaokeReachableStep,
  karaokeSearchWithStep,
  karaokeStepFromSearch,
  karaokeSteps,
  type KaraokeDraft,
  type KaraokeStepId,
  type KaraokeStepRules,
  type KaraokeTicks,
} from "./karaoke-wizard";
import { PageHero } from "./page-hero";
// Type-only: karaoke-core builds Zod schemas at load, and a value import from
// it ships all of Zod to the browser. The quote maths comes from the
// dependency-free module instead.
import type { KaraokeAvailability } from "@/lib/mobile/karaoke-core";
import {
  karaokeParams,
  navigateAfterPixel,
  trackPixel,
} from "@/lib/consent/meta-pixel";
import {
  formatReservationDate,
  formatReservationTime,
  hourFromLabel,
} from "@/lib/mobile/karaoke-format";
import {
  karaokeDiscountPctFor,
  quoteKaraoke,
} from "@/lib/mobile/karaoke-quote";
import {
  KARAOKE_BUSINESS_CANCEL,
  KARAOKE_NO_WITHDRAWAL,
  KARAOKE_PAYMENT_PAGE_MINUTES,
} from "@/lib/mobile/karaoke-time";
import { priceLabel } from "@/lib/utils/format";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];

/** "2026-09-08" → "Pzt 8 Eyl", with today and tomorrow named. */
function dayLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return "Bugün";
  if (date === tomorrow) return "Yarın";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const month = new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    timeZone: "UTC",
  }).format(dt);
  return `${DAY_NAMES[dt.getUTCDay()]} ${d} ${month}`;
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export interface KaraokeBookingProps {
  /** The bookable window, as Istanbul calendar days. */
  days: string[];
  date: string;
  /**
   * The hour asked for in the URL (`?saat=`, the home page's chips). Taken
   * only when it is free on `date`; the first free hour otherwise.
   */
  initialHour?: number | null;
  availability: KaraokeAvailability | null;
  /** True when the calendar could not be read at all. */
  unavailable: boolean;
  capacity: number;
  hourlyMinor: number;
  /**
   * The evening's closing hour (`mobileApp.karaoke.closeHour`, 24 =
   * midnight), named in the heading. It used to be typed in there.
   */
  closeHour: number;
  tier: string | null;
  tierLabel: string | null;
  isAuthenticated: boolean;
  emailVerified: boolean;
  phone: string;
  /** The köşk's address, printed in the pre-payment box (MSY m.5/1-c). */
  address: string;
  /**
   * Who sells (MSY m.5/1-b): the company's title and tax number, handed down
   * by the page from `LEGAL_ENTITY` (this client component does not import
   * entity.ts). Either may be empty; an empty one is left out, never made up
   * (CLAUDE.md rule 13).
   */
  sellerName?: string;
  taxNo?: string;
  /**
   * Online prepayment is on (`settings.karaokePrepay`): the booking is paid
   * right away, confirmed by its payment, and open to guests without an
   * account. Off: the old request flow, members only, paid at the venue.
   */
  prepay: boolean;
  /** The signed-in member's details, to prefill the contact block. */
  contact?: { name: string; email: string; phone: string };
  /**
   * The server's clock when the page was drawn (ISO), so the box does not
   * name a free-cancel moment that has already gone by. Without it the
   * moment is always named.
   */
  now?: string;
}

/** How many step entries this page pushed above the one it opened on. */
function readDepth(): number {
  const d = (window.history.state as { karaokeDepth?: unknown } | null)
    ?.karaokeDepth;
  return typeof d === "number" && Number.isInteger(d) && d > 0 ? d : 0;
}

/** The step the entry under this one shows (where the browser's back lands). */
function readPrev(): number | null {
  const p = (window.history.state as { karaokePrev?: unknown } | null)
    ?.karaokePrev;
  return typeof p === "number" && Number.isInteger(p) && p >= 0 ? p : null;
}

/**
 * "%20 KDV dahil (KDV 166,67₺)" under a total: small and muted, never the
 * number itself. A narrow line breaks between the two halves, not inside
 * the amount.
 */
function KdvNote({
  kdv,
  className,
}: {
  kdv: KdvIncludedParts;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="kdv-part">{kdv.rate}</span>
      {kdv.amount ? (
        <>
          {" "}
          <span className="kdv-part">({kdv.amount})</span>
        </>
      ) : null}
    </span>
  );
}

export function KaraokeBooking({
  days,
  date,
  initialHour = null,
  availability,
  unavailable,
  capacity,
  hourlyMinor,
  closeHour,
  tier,
  tierLabel,
  isAuthenticated,
  emailVerified,
  phone,
  address,
  sellerName = "",
  taxNo = "",
  prepay,
  contact,
  now,
}: KaraokeBookingProps) {
  const slots = availability?.slots ?? [];
  const firstFree = slots.find((s) => s.available)?.startHour;
  const askedFree =
    initialHour !== null &&
    slots.some((s) => s.startHour === initialHour && s.available);
  // The hour this address asks for, as the draft remembers it.
  const asked = askedFree ? initialHour : null;
  // Who may submit: a verified member, or - with prepayment on - anyone,
  // who then types their own contact details.
  const guest = !isAuthenticated && prepay;
  const canBook = (isAuthenticated && emailVerified) || guest;

  const [s, dispatch] = useReducer(
    karaokeBookingReducer,
    {
      steps: karaokeSteps({ prepay, canBook }),
      draft: {
        startHour: askedFree ? initialHour : (firstFree ?? null),
        hours: 1,
        guests: Math.min(4, capacity),
        note: "",
        guestFirstName: "",
        guestLastName: "",
        contactPhone: "",
        contactEmail: "",
      },
    },
    karaokeBookingInit,
  );
  const { startHour, hours, guests, note } = s.draft;
  const edit = (patch: Partial<KaraokeDraft>) =>
    dispatch({ type: "edit", patch });
  const tick = (key: keyof KaraokeTicks) => (ticked: boolean) =>
    dispatch({ type: "tick", key, ticked });

  const [state, formAction, pending] = useActionState<
    BookKaraokeState,
    FormData
  >(bookKaraokeAction, {});

  const maxHours = availability?.maxHours ?? 3;
  const hourly = availability?.hourlyMinor ?? hourlyMinor;
  const oroPct = availability?.oroDiscountPct ?? 15;
  const discountPct = karaokeDiscountPctFor(tier, oroPct);
  const quote = quoteKaraoke(hours, hourly, tier, oroPct);
  // The karaoke rate from Ayarlar > Vergi; the total already includes it.
  const kdv = kdvIncludedParts(quote.totalMinor, availability?.taxRatePct);
  // The rule a booking made now gets, in the server's words.
  const terms = karaokeBookingTerms(availability, {
    date,
    startHour,
    totalMinor: quote.totalMinor,
    now: now ? new Date(now) : undefined,
  });

  const rules: KaraokeStepRules = {
    slots,
    unavailable,
    capacity,
    maxHours,
    contact: guest
      ? "guest"
      : isAuthenticated && emailVerified && !contact?.phone
        ? "phone"
        : "none",
    prepay,
    termsReady: terms !== null,
  };

  const steps = s.steps;
  const current: KaraokeStepId = steps[s.step];
  const last = s.step === steps.length - 1;
  const reachable = karaokeReachableStep(steps, s.draft, s.ticks, rules);
  const shown = (id: KaraokeStepId) => !s.enhanced || id === current;
  const number = (id: KaraokeStepId) => steps.indexOf(id) + 1;

  const today = days[0];
  const tomorrow = days[1];
  // Signing in comes back to this day and this hour.
  const backHere =
    startHour !== null
      ? `/karaoke?tarih=${date}&saat=${startHour}`
      : `/karaoke?tarih=${date}`;
  const selectionValid =
    startHour !== null &&
    karaokeBlockIsFree(slots, startHour, hours) &&
    !unavailable;

  const flowRef = useRef<HTMLDivElement>(null);
  /** A field on an earlier step the browser refused; shown once it is back. */
  const invalidRef = useRef<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  >(null);

  // ── Hydrated: the values a refresh kept, and the step in the address ──
  const restore = useEffectEvent(() => {
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(KARAOKE_DRAFT_KEY);
    } catch {
      // Storage blocked (a private window): the form starts empty.
    }
    dispatch({
      type: "restore",
      draft: karaokeDraftFromJson(saved, {
        date,
        slots,
        capacity,
        maxHours,
        asked,
      }),
      step: karaokeStepFromSearch(window.location.search),
      rules,
    });
  });
  useEffect(() => {
    // One update right after hydration, as LaffogatoApp reads its hash: the
    // server cannot know what this tab saved, so the first render matches
    // the server's single form and the steps take over from here.
    restore();
  }, []);

  // The browser's back and forward move between steps (`?adim=`).
  const onPopState = useEffectEvent(() => {
    dispatch({
      type: "go",
      step: karaokeStepFromSearch(window.location.search),
      rules,
      nav: "replace",
      any: true,
    });
  });
  useEffect(() => {
    const handler = () => onPopState();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Every move lands in the address bar: forward moves push an entry, so the
  // browser's back button is one step back; only the step number goes there.
  useEffect(() => {
    if (!s.enhanced || s.nav === "none") return;
    const search = karaokeSearchWithStep(window.location.search, s.step);
    if (search === window.location.search) return;
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    const depth = readDepth();
    if (s.nav === "push") {
      // The entry left below shows the step being left.
      const prev = karaokeStepFromSearch(window.location.search);
      window.history.pushState(
        { karaokeDepth: depth + 1, karaokePrev: prev },
        "",
        url,
      );
    } else {
      window.history.replaceState(
        { karaokeDepth: depth, karaokePrev: readPrev() },
        "",
        url,
      );
    }
  }, [s.seq, s.enhanced, s.nav, s.step]);

  // A move the visitor made puts them at the top of the new step.
  useEffect(() => {
    if (!s.enhanced || !s.focus) return;
    const bad = invalidRef.current;
    invalidRef.current = null;
    if (bad?.isConnected) {
      bad.reportValidity();
      return;
    }
    const heading = flowRef.current?.querySelector<HTMLElement>(
      `:scope > [data-step="${steps[s.step]}"] .kw-step-title`,
    );
    heading?.focus({ preventScroll: true });
    // Out of sight, or far down the screen behind the bar on a phone: the
    // new step is brought up to just under the header.
    const top = flowRef.current;
    const at = top?.getBoundingClientRect().top ?? 0;
    if (top && (at < 0 || at > window.innerHeight * 0.3)) {
      const still = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      top.scrollIntoView({
        block: "start",
        behavior: still ? "auto" : "smooth",
      });
    }
  }, [s.seq, s.enhanced, s.focus, s.step, steps]);

  // What a refresh keeps: this tab only, the values the form already holds,
  // never a ticked box. Gone once the booking is sent; written again when
  // the answer is a refusal (`state` is a new object with every answer), so
  // a refresh or another day after a refused booking still has them.
  useEffect(() => {
    if (!s.enhanced || state.booked || state.checkout) return;
    try {
      window.sessionStorage.setItem(
        KARAOKE_DRAFT_KEY,
        karaokeDraftToJson(date, s.draft, asked),
      );
    } catch {
      // Storage blocked: nothing kept, nothing lost.
    }
  }, [s.enhanced, s.draft, date, asked, state]);

  // One booking post at a time: a second press before the answer is dropped.
  const posting = useRef(false);
  useEffect(() => {
    if (!pending) posting.current = false;
  }, [pending]);

  // ── Meta Pixel (marketing consent only; src/lib/consent/meta-pixel.ts) ──
  // ViewContent when the page opens, with one hour's price.
  const viewed = useRef(false);
  const reportView = useEffectEvent(() => {
    trackPixel("ViewContent", karaokeParams(hourly, 1));
  });
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    reportView();
  }, []);
  // AddToCart the first time a date and an hour are chosen, once per page:
  // the hour pressed, or the step left with the hour it already showed.
  const carted = useRef(false);
  function reportAddToCart(hour: number | null) {
    if (carted.current || hour === null) return;
    if (!karaokeBlockIsFree(slots, hour, hours) || unavailable) return;
    carted.current = true;
    trackPixel("AddToCart", karaokeParams(quote.totalMinor, hours));
  }
  // The booking exists and the server handed over the card page's address
  // instead of redirecting (the visitor consented to the pixel): InitiateCheckout
  // first, deduplicated by the booking's id, then on to the card page.
  const checkedOut = useRef<string | null>(null);
  const onCheckout = useEffectEvent(
    (c: NonNullable<BookKaraokeState["checkout"]>) => {
      const sent = trackPixel(
        "InitiateCheckout",
        karaokeParams(c.valueMinor, c.hours),
        `checkout_${c.id}`,
      );
      navigateAfterPixel(c.continueTo, sent);
    },
  );
  useEffect(() => {
    const c = state.checkout;
    if (!c || checkedOut.current === c.id) return;
    checkedOut.current = c.id;
    onCheckout(c);
  }, [state.checkout]);
  // Back from the card page out of the browser's page cache would bring this
  // screen back frozen on "redirecting" with the pay button off: load it fresh.
  useEffect(() => {
    if (!state.checkout) return;
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [state.checkout]);

  /** The browser's own checks on the step's fields, then the step's rules. */
  function onNext() {
    const section = flowRef.current?.querySelector<HTMLElement>(
      `:scope > [data-step="${current}"]`,
    );
    const bad = section
      ? [
          ...section.querySelectorAll<HTMLInputElement>(
            "input, select, textarea",
          ),
        ].find((el) => !el.checkValidity())
      : undefined;
    if (bad) {
      bad.reportValidity();
      return;
    }
    if (current === "when") reportAddToCart(startHour);
    dispatch({ type: "next", rules });
  }

  function onBack() {
    if (s.step === 0) return;
    // The entry under this one is the step before: the browser's back is the
    // same move, and keeps its history in step. After a jump back it is a
    // later step (Geri went forward to Özet ve onay), and a refreshed page
    // has none: the step goes back here instead.
    if (
      karaokeBackIsHistory({
        step: s.step,
        depth: readDepth(),
        prev: readPrev(),
      })
    ) {
      window.history.back();
      return;
    }
    dispatch({ type: "back" });
  }

  function goTo(step: number) {
    dispatch({ type: "go", step, rules, nav: "push" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // Enter in a field moves on, as "Devam" does, rather than submitting a
    // booking from a step that does not show its button.
    if (!s.enhanced || e.key !== "Enter" || last) return;
    const t = e.target;
    if (
      t instanceof HTMLInputElement &&
      !["checkbox", "radio", "submit", "button"].includes(t.type)
    ) {
      e.preventDefault();
      onNext();
    }
  }

  function onSubmitClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!s.enhanced) return;
    const form = e.currentTarget.form;
    if (!form || form.checkValidity()) return;
    // A field on a step that is not showing is wrong. The browser would
    // refuse the post without a word (it cannot point at a hidden field):
    // go back to that step and show it there.
    const bad = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:invalid, select:invalid, textarea:invalid");
    const id = bad?.closest<HTMLElement>("[data-step]")?.dataset.step;
    const at = id ? steps.indexOf(id as KaraokeStepId) : -1;
    // On the step in view the browser points at the field itself.
    if (at === s.step) return;
    e.preventDefault();
    if (bad && at >= 0) {
      invalidRef.current = bad;
      dispatch({ type: "go", step: at, rules, nav: "push", any: true });
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (s.enhanced && !last) {
      e.preventDefault();
      onNext();
      return;
    }
    // Posted by hand, not as the form's action. React empties a form whose
    // action finishes, whatever it answers: a refused booking came back with
    // the boxes unticked behind a ticked state, so the next press on Ödeme
    // was sent back to Özet ve onay without a word. A post started here is
    // not a form action, so nothing is reset (the panel's forms post the same
    // way, components/admin/ui/submit.ts). Without JavaScript there is no
    // onSubmit and the form posts to the action itself.
    e.preventDefault();
    if (posting.current) return;
    posting.current = true;
    // The pay button has no name: the fields are the whole post.
    const formData = new FormData(e.currentTarget);
    try {
      window.sessionStorage.removeItem(KARAOKE_DRAFT_KEY);
    } catch {
      // Storage blocked: there was nothing kept.
    }
    startTransition(() => formAction(formData));
  }

  if (state.booked) {
    return (
      <div className="wrap karaoke-page">
        <div className="karaoke-done">
          <Illustration
            name="karaoke-room"
            width={220}
            className="karaoke-done-art illo-framed"
          />
          <div className="eyebrow">Karaoke · rezervasyon alındı</div>
          <h1 className="h1" style={{ marginTop: 14 }}>
            Görüşmek üzere
          </h1>
          <p className="lede" style={{ marginTop: 16 }}>
            {dayLabel(state.booked.date, today, tomorrow)} ·{" "}
            {hourLabel(state.booked.startHour)} · {state.booked.hours} saat ·{" "}
            {state.booked.guests} kişi. Ekibimiz onaylayınca haber veririz;
            ödemeyi köşkte yaparsın.
          </p>
          <div className="cta-row">
            <Link href="/uye/hesap" className="btn btn-primary">
              Hesabıma git
              <span className="arrow">→</span>
            </Link>
            <Link href="/" className="btn btn-ghost">
              Anasayfa
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const when =
    startHour !== null
      ? `${formatReservationDate(date)}, ${formatReservationTime(startHour, hours)}`
      : `${formatReservationDate(date)} (saat seçilmedi)`;
  // Who the booking is for, as the review lists it.
  const contactLines = (
    guest
      ? [
          `${s.draft.guestFirstName} ${s.draft.guestLastName}`.trim(),
          s.draft.contactPhone,
          s.draft.contactEmail,
        ]
      : [contact?.name, contact?.email, contact?.phone || s.draft.contactPhone]
  ).filter((line): line is string => !!line && line.trim() !== "");
  const seller = [
    `Satıcı: ${sellerName ? `${sellerName} (L'Affogato)` : "L'Affogato"}`,
    taxNo ? `VKN ${taxNo}` : "",
    address,
  ]
    .filter(Boolean)
    .join(", ");
  // A phone number is never broken across two lines.
  const tel = <span className="kw-nowrap">{phone}</span>;

  /** "1 Tarih ve saat": the step's heading, where a move puts the focus. */
  const title = (id: KaraokeStepId) => (
    <h2 id={`kw-${id}-title`} className="kw-step-title" tabIndex={-1}>
      <span className="kw-step-n" aria-hidden="true">
        {number(id)}
      </span>
      {KARAOKE_STEP_LABELS[id]}
    </h2>
  );
  /** Why "Devam" did not move, under the step it is about. */
  const stepError = (id: KaraokeStepId) =>
    s.enhanced && s.error && id === current ? (
      <p role="alert" className="kw-error">
        {s.error}
      </p>
    ) : null;
  const change = (id: KaraokeStepId) =>
    s.enhanced ? (
      <button
        type="button"
        className="kw-change"
        onClick={() => goTo(steps.indexOf(id))}
        aria-label={`${KARAOKE_STEP_LABELS[id]}: değiştir`}
      >
        Değiştir
      </button>
    ) : null;

  const submit = (
    <>
      {state.error && (
        <p role="alert" className="kw-error">
          {state.error}
        </p>
      )}
      {state.checkout && (
        <p role="status" className="karaoke-fine">
          Ödeme sayfasına yönlendiriliyorsun.{" "}
          <a href={state.checkout.continueTo}>Açılmazsa buraya dokun.</a>
        </p>
      )}
      <button
        type="submit"
        className="btn btn-gold karaoke-pay"
        // `state.checkout`: the booking exists and the browser is on its way
        // to the card page; a second press would book the hour again.
        disabled={!selectionValid || pending || !!state.checkout}
        aria-busy={pending}
        onClick={onSubmitClick}
      >
        {pending ? (
          <>
            <BusyDots />
            Gönderiliyor…
          </>
        ) : prepay ? (
          `Rezervasyonu onayla ve ${priceLabel(quote.totalMinor)} öde`
        ) : (
          "Rezervasyon iste"
        )}
      </button>
      <p className="karaoke-fine">
        {prepay
          ? "Bu düğmeyle ödeme yükümlülüğü altına girersin. Kartını bir sonraki sayfada yazarsın."
          : "Ekibimiz onaylayınca haber veririz; ödemeyi köşkte yaparsın."}
      </p>
    </>
  );

  return (
    <div
      className="karaoke-page"
      data-wizard={s.enhanced ? "on" : undefined}
      data-wizard-step={s.enhanced ? current : undefined}
    >
      <PageHero
        scene="berry"
        eyebrow="Karaoke · köşkün üst katı"
        title={["Özel oda,", `gece ${hourToLabel(closeHour)} kadar`]}
        art={
          <Illustration
            name="karaoke-room"
            width={220}
            className="illo-framed"
            sizes="(max-width: 760px) 116px, 220px"
            priority
          />
        }
        lede={
          prepay
            ? `${capacity} kişilik oda. Saatini seç, kartınla öde; rezervasyonun hemen kesinleşir.`
            : `${capacity} kişilik oda. Saatini seç, isteğini gönder.`
        }
      />
      <div className="wrap">
        <form
          action={formAction}
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          className="karaoke-layout"
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="startHour" value={startHour ?? ""} />
          <input type="hidden" name="hours" value={hours} />
          <input type="hidden" name="guests" value={guests} />
          <input type="hidden" name="note" value={note} />

          <div className="karaoke-flow" ref={flowRef}>
            {s.enhanced ? (
              <nav className="kw-progress" aria-label="Rezervasyon adımları">
                <ol
                  style={{ "--kw-count": steps.length } as React.CSSProperties}
                >
                  {steps.map((id, i) => {
                    const here = i === s.step;
                    const open =
                      !here && i <= Math.min(reachable, s.reached) && !pending;
                    const inner = (
                      <>
                        <span className="kw-progress-bar" aria-hidden="true" />
                        <span className="kw-progress-label">
                          <span className="kw-progress-n">{i + 1}.</span>{" "}
                          {KARAOKE_STEP_LABELS[id]}
                        </span>
                      </>
                    );
                    return (
                      <li
                        key={id}
                        className="kw-progress-item"
                        data-state={
                          here ? "current" : i < s.step ? "done" : "todo"
                        }
                        aria-current={here ? "step" : undefined}
                      >
                        {open ? (
                          <button
                            type="button"
                            className="kw-progress-cell"
                            onClick={() => goTo(i)}
                          >
                            {inner}
                          </button>
                        ) : (
                          <span className="kw-progress-cell">{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <p className="kw-progress-caption" aria-hidden="true">
                  Adım {s.step + 1} / {steps.length}
                </p>
              </nav>
            ) : null}
            {s.enhanced ? (
              // The step a move lands on, read out once.
              <p className="sr-only" role="status">
                Adım {s.step + 1} / {steps.length}:{" "}
                {KARAOKE_STEP_LABELS[current]}
              </p>
            ) : null}

            {/* 1. Tarih ve saat */}
            <section
              className="kw-step"
              data-step="when"
              hidden={!shown("when")}
              aria-labelledby="kw-when-title"
            >
              {title("when")}
              <div className="kw-field">
                <span className="eyebrow muted" id="kw-day-label">
                  Gün
                </span>
                <div
                  className="karaoke-days scroller"
                  role="group"
                  aria-labelledby="kw-day-label"
                >
                  {days.map((d) => (
                    <a
                      key={d}
                      /* The day is a server round-trip: picking one re-reads
                       the real calendar rather than trusting a snapshot. */
                      href={`/karaoke?tarih=${d}`}
                      className={`karaoke-day ${d === date ? "on" : ""}`}
                      aria-current={d === date || undefined}
                    >
                      {dayLabel(d, today, tomorrow)}
                    </a>
                  ))}
                </div>
              </div>

              <div className="kw-field">
                <span className="eyebrow muted" id="kw-hour-label">
                  Saat
                </span>
                {unavailable ? (
                  <p className="karaoke-warn">
                    Takvime şu an ulaşamıyoruz. Biraz sonra tekrar dene ya da
                    bizi ara: {tel}.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="karaoke-warn">
                    Bu gün boş saat kalmadı. Başka bir gün seç.
                  </p>
                ) : (
                  <div
                    className="karaoke-hours"
                    role="group"
                    aria-labelledby="kw-hour-label"
                  >
                    {slots.map((slot) => {
                      const taken = !slot.available;
                      const on = startHour === slot.startHour;
                      return (
                        <button
                          key={slot.startHour}
                          type="button"
                          className={`karaoke-hour ${on ? "on" : ""} ${taken ? "taken" : ""}`}
                          disabled={taken}
                          aria-pressed={on}
                          onClick={() => {
                            edit({ startHour: slot.startHour });
                            reportAddToCart(slot.startHour);
                          }}
                        >
                          <span className="karaoke-hour-t">
                            {hourLabel(slot.startHour)}
                          </span>
                          <span className="karaoke-hour-n">
                            {taken ? "dolu" : "uygun"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {stepError("when")}
            </section>

            {/* 2. Süre ve kişi */}
            <section
              className="kw-step"
              data-step="size"
              hidden={!shown("size")}
              aria-labelledby="kw-size-title"
            >
              {title("size")}
              <div className="kw-size">
                <div className="kw-field">
                  <span className="eyebrow muted">Süre</span>
                  <div className="karaoke-stepper">
                    <button
                      type="button"
                      onClick={() => edit({ hours: Math.max(1, hours - 1) })}
                      aria-label="Süreyi azalt"
                      className="karaoke-step-down"
                    >
                      −
                    </button>
                    <span className="karaoke-step-value" aria-live="polite">
                      {hours} saat
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        edit({ hours: Math.min(maxHours, hours + 1) })
                      }
                      aria-label="Süreyi artır"
                      className="karaoke-step-up"
                    >
                      +
                    </button>
                  </div>
                  {startHour !== null &&
                  !karaokeBlockIsFree(slots, startHour, hours) ? (
                    <div className="karaoke-hint karaoke-hint-warn">
                      {hourFromLabel(startHour)} itibaren {hours} saat boş
                      değil. Süreyi kısalt ya da başka saat seç.
                    </div>
                  ) : (
                    <div className="karaoke-hint">
                      En fazla {maxHours} saat. Saati {priceLabel(hourly)}.
                    </div>
                  )}
                </div>

                <div className="kw-field">
                  <span className="eyebrow muted">Kişi</span>
                  <div className="karaoke-stepper">
                    <button
                      type="button"
                      onClick={() => edit({ guests: Math.max(1, guests - 1) })}
                      aria-label="Kişi azalt"
                      className="karaoke-step-down"
                    >
                      −
                    </button>
                    <span className="karaoke-step-value" aria-live="polite">
                      {guests} kişi
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        edit({ guests: Math.min(capacity, guests + 1) })
                      }
                      aria-label="Kişi artır"
                      className="karaoke-step-up"
                    >
                      +
                    </button>
                  </div>
                  <div className="karaoke-hint">
                    En fazla {capacity} kişi. Daha kalabalık gruplar için ara:{" "}
                    {tel}.
                  </div>
                </div>
              </div>
              {stepError("size")}
            </section>

            {/* 3. Bilgilerin */}
            <section
              className="kw-step"
              data-step="details"
              hidden={!shown("details")}
              aria-labelledby="kw-details-title"
            >
              {title("details")}
              {isAuthenticated && emailVerified ? (
                <fieldset className="karaoke-contact">
                  <legend className="eyebrow muted">İletişim</legend>
                  {/* A member's details are already on the account - shown,
                      not asked again. Only a missing phone opens a field. */}
                  <input
                    type="hidden"
                    name="contactName"
                    value={contact?.name ?? ""}
                  />
                  <input
                    type="hidden"
                    name="contactEmail"
                    value={contact?.email ?? ""}
                  />
                  {contact?.phone ? (
                    <input
                      type="hidden"
                      name="contactPhone"
                      value={contact.phone}
                    />
                  ) : null}
                  <div className="karaoke-contact-card">
                    <span className="karaoke-contact-name">
                      {contact?.name || "Üye"}
                    </span>
                    <span className="karaoke-contact-line">
                      {contact?.email}
                      {contact?.phone ? ` · ${contact.phone}` : ""}
                    </span>
                    <Link
                      href="/uye/hesap/bilgilerim"
                      className="karaoke-contact-edit"
                    >
                      Düzenle
                    </Link>
                  </div>
                  {!contact?.phone && (
                    <label className="karaoke-field">
                      <span>Cep telefonu</span>
                      <input
                        className="input"
                        name="contactPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0532 123 45 67"
                        maxLength={40}
                        required
                        value={s.draft.contactPhone}
                        onChange={(e) => edit({ contactPhone: e.target.value })}
                      />
                    </label>
                  )}
                </fieldset>
              ) : null}

              {guest ? (
                <fieldset className="karaoke-contact">
                  <legend className="eyebrow muted">İletişim</legend>
                  <p className="karaoke-hint" style={{ marginTop: 0 }}>
                    Hesap açılmaz; rezervasyon bağlantın e-postana gelir.{" "}
                    <a
                      href={`/uye/giris?next=${encodeURIComponent(backHere)}`}
                      className="karaoke-link"
                    >
                      Üyeysen giriş yap
                    </a>
                    .
                  </p>
                  <div className="karaoke-guest-grid">
                    <label className="karaoke-field">
                      <span>Ad</span>
                      <input
                        className="input"
                        name="guestFirstName"
                        autoComplete="given-name"
                        maxLength={60}
                        required
                        value={s.draft.guestFirstName}
                        onChange={(e) =>
                          edit({ guestFirstName: e.target.value })
                        }
                      />
                    </label>
                    <label className="karaoke-field">
                      <span>Soyad</span>
                      <input
                        className="input"
                        name="guestLastName"
                        autoComplete="family-name"
                        maxLength={60}
                        required
                        value={s.draft.guestLastName}
                        onChange={(e) =>
                          edit({ guestLastName: e.target.value })
                        }
                      />
                    </label>
                    <label className="karaoke-field">
                      <span>Cep telefonu</span>
                      <input
                        className="input"
                        name="contactPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0532 123 45 67"
                        maxLength={40}
                        required
                        value={s.draft.contactPhone}
                        onChange={(e) => edit({ contactPhone: e.target.value })}
                      />
                    </label>
                    <label className="karaoke-field">
                      <span>E-posta</span>
                      <input
                        className="input"
                        name="contactEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={200}
                        required
                        value={s.draft.contactEmail}
                        onChange={(e) => edit({ contactEmail: e.target.value })}
                      />
                    </label>
                  </div>
                </fieldset>
              ) : null}

              {!canBook && !isAuthenticated ? (
                <div className="kw-signin">
                  <p>
                    Rezervasyon isteği için üye girişi gerekiyor; ödemeyi köşkte
                    yaparsın.
                  </p>
                  <a
                    href={`/uye/giris?next=${encodeURIComponent(backHere)}`}
                    className="btn btn-gold"
                  >
                    Giriş yap ve rezerve et
                  </a>
                  <p className="karaoke-fine">
                    Hesabın yoksa{" "}
                    <a href="/uye/kayit" className="karaoke-link">
                      üye ol
                    </a>
                    .
                  </p>
                </div>
              ) : !canBook ? (
                <div className="kw-signin">
                  <p>
                    Önce e-postanı doğrula.{" "}
                    <a href="/uye/hesap" className="karaoke-link">
                      Bağlantıyı yeniden gönder
                    </a>
                    .
                  </p>
                </div>
              ) : null}

              {canBook ? (
                <div className="kw-field">
                  <label className="eyebrow muted" htmlFor="karaoke-note">
                    Not (isteğe bağlı)
                  </label>
                  <input
                    id="karaoke-note"
                    className="input"
                    value={note}
                    maxLength={200}
                    onChange={(e) => edit({ note: e.target.value })}
                    placeholder="Doğum günü, pasta, özel istek…"
                  />
                </div>
              ) : null}
              {stepError("details")}
            </section>

            {/* 4. Özet ve onay */}
            {canBook ? (
              <section
                className="kw-step"
                data-step="review"
                hidden={!shown("review")}
                aria-labelledby="kw-review-title"
              >
                {title("review")}
                <dl className="kw-review">
                  <div>
                    <dt>Tarih ve saat</dt>
                    <dd>
                      {formatReservationDate(date)},{" "}
                      <span className="kdv-part">
                        {startHour !== null
                          ? formatReservationTime(startHour, hours)
                          : "saat seçilmedi"}
                      </span>
                    </dd>
                    {change("when")}
                  </div>
                  <div>
                    <dt>Süre ve kişi</dt>
                    <dd>
                      {hours} saat · {guests} kişi
                    </dd>
                    {change("size")}
                  </div>
                  {contactLines.length > 0 || note ? (
                    <div>
                      <dt>İletişim</dt>
                      <dd>
                        {/* One line each: a phone number or an address is
                            never broken across two. */}
                        {contactLines.map((line, i) => (
                          <span key={i} className="kw-review-line">
                            {line}
                          </span>
                        ))}
                        {note ? (
                          <span className="kw-review-sub">Not: {note}</span>
                        ) : null}
                      </dd>
                      {change("details")}
                    </div>
                  ) : null}
                  {discountPct > 0 ? (
                    <div>
                      <dt>İndirim</dt>
                      <dd>
                        {tierLabel ?? "Üyelik"} indirimi %{discountPct}: −
                        {priceLabel(quote.discountMinor)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {prepay ? (
                  <>
                    <div className="karaoke-preinfo">
                      <h3 id="karaoke-preinfo-title" className="h4">
                        Ödemeden önce
                      </h3>
                      <ul>
                        <li>
                          {when}
                          {startHour !== null ? ` (${hours} saat)` : ""} ·{" "}
                          {guests} kişi ·{" "}
                          <strong>Toplam {priceLabel(quote.totalMinor)}</strong>{" "}
                          <KdvNote kdv={kdv} className="kw-kdv" />
                        </li>
                        <li>{KARAOKE_NO_WITHDRAWAL}</li>
                        {terms ? (
                          <li>
                            <strong>İptal:</strong> {terms.rules[0]}{" "}
                            {terms.rules[1]}
                            {terms.freeUntil ? (
                              <span className="kw-terms-line">
                                Ücretsiz iptal için son an: {terms.freeUntil}.
                              </span>
                            ) : terms.freePassed ? (
                              <span className="kw-terms-line">
                                Seçtiğin saat için ücretsiz iptal süresi geçti;
                                yapacağın her iptal geç iptal sayılır.
                              </span>
                            ) : null}
                            {terms.lateShareMinor !== null ? (
                              <span className="kw-terms-line">
                                {/* "Sonrasında" only after a moment it
                                    follows. */}
                                {terms.freeUntil
                                  ? "Sonrasında, rezervasyon"
                                  : "Rezervasyon"}{" "}
                                saatinden önce iptal edersen{" "}
                                {priceLabel(terms.lateShareMinor)} kartına iade
                                edilir.
                              </span>
                            ) : null}
                          </li>
                        ) : (
                          <li>
                            <strong>İptal:</strong> İptal kuralını şu an
                            okuyamadık; sayfayı yenile.
                          </li>
                        )}
                      </ul>
                      {/* The rule printed above, echoed: a booking whose rule
                          changed while this page was open is refused. */}
                      {terms ? (
                        <>
                          <input
                            type="hidden"
                            name="expectedFreeCancelHours"
                            value={terms.policy.freeCancelHours}
                          />
                          <input
                            type="hidden"
                            name="expectedLateRefundPercent"
                            value={terms.policy.lateRefundPercent}
                          />
                        </>
                      ) : null}
                      {/* The rest of the pre-information, one tap away:
                          native and JS-free, and still in the markup when
                          closed. */}
                      <details className="karaoke-preinfo-more">
                        <summary>Ayrıntılar</summary>
                        <ul>
                          <li>
                            Oda seçtiğin saatlerde yalnız senin grubuna ayrılır.
                            Yiyecek ve içecek ayrıca ödenir; başka ücret yok.
                          </li>
                          <li>
                            Kartla tek çekim, PayNkolay 3D Secure ile. Kart
                            bilgilerin bizde saklanmaz. Ödeme sayfası{" "}
                            {KARAOKE_PAYMENT_PAGE_MINUTES} dakika açık kalır;
                            saat bu sürede senin için tutulur.
                          </li>
                          <li>
                            Ödeme onaylanınca rezervasyonun kesinleşir,
                            ödenmezse düşer. Kodun ve bağlantın e-postana gelir.
                          </li>
                          <li>{KARAOKE_BUSINESS_CANCEL}</li>
                        </ul>
                      </details>
                    </div>
                    {/* Who sells stays in sight, not behind the disclosure
                        (MSY m.5/1-b, c). */}
                    <p className="karaoke-seller">
                      {seller}
                      {phone ? <>, {tel}</> : null}.
                    </p>
                  </>
                ) : null}

                <div
                  className="karaoke-consents"
                  role="group"
                  aria-label="Onaylar"
                >
                  {prepay ? (
                    <>
                      <label className="karaoke-consent">
                        <input
                          type="checkbox"
                          name="consentPreInfo"
                          required
                          checked={s.ticks.preInfo}
                          onChange={(e) => tick("preInfo")(e.target.checked)}
                        />
                        <span>
                          <Link
                            href="/hukuk/karaoke-odasi-rezervasyon"
                            target="_blank"
                          >
                            Ön Bilgilendirme Formu
                          </Link>
                          &apos;nu okudum ve onaylıyorum.
                        </span>
                      </label>
                      <label className="karaoke-consent">
                        <input
                          type="checkbox"
                          name="consentContract"
                          required
                          checked={s.ticks.contract}
                          onChange={(e) => tick("contract")(e.target.checked)}
                        />
                        <span>
                          <Link
                            href="/hukuk/karaoke-odasi-rezervasyon"
                            target="_blank"
                          >
                            Mesafeli Hizmet Sözleşmesi
                          </Link>
                          &apos;ni okudum ve kabul ediyorum.
                        </span>
                      </label>
                    </>
                  ) : null}
                  <label className="karaoke-consent">
                    <input
                      type="checkbox"
                      name="consentKvkk"
                      required
                      checked={s.ticks.kvkk}
                      onChange={(e) => tick("kvkk")(e.target.checked)}
                    />
                    <span>
                      Kişisel verilerimin rezervasyonun yapılması ve yönetilmesi
                      için işlenmesine ilişkin{" "}
                      <Link href="/hukuk/kvkk-aydinlatma-metni" target="_blank">
                        Aydınlatma Metni
                      </Link>
                      &apos;ni okudum.
                    </span>
                  </label>
                </div>
                {stepError("review")}
                {prepay ? null : submit}
              </section>
            ) : null}

            {/* 5. Ödeme: the price, what is bought and the pay button
                together, right before the payment obligation (MSY m.6/2-a). */}
            {canBook && prepay ? (
              <section
                className="kw-step"
                data-step="pay"
                hidden={!shown("pay")}
                aria-labelledby="kw-pay-title"
              >
                {title("pay")}
                <div className="kw-paybox">
                  <p className="kw-paybox-what">
                    Karaoke odası · {when}
                    {startHour !== null ? ` (${hours} saat)` : ""} · {guests}{" "}
                    kişi
                  </p>
                  <div className="kw-paybox-total">
                    <span>Ödenecek toplam</span>
                    <strong>{priceLabel(quote.totalMinor)}</strong>
                  </div>
                  <p className="kw-paybox-kdv">
                    <KdvNote kdv={kdv} className="kw-kdv" />
                  </p>
                  <p className="kw-paybox-note">{KARAOKE_NO_WITHDRAWAL}</p>
                </div>
                {submit}
              </section>
            ) : null}

            {s.enhanced ? (
              <div className="kw-nav">
                <div className="kw-nav-total">
                  <strong>{priceLabel(quote.totalMinor)}</strong>
                  <KdvNote kdv={kdv} className="kw-kdv" />
                </div>
                <div className="kw-nav-actions">
                  {s.step > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost kw-back"
                      onClick={onBack}
                      disabled={pending}
                    >
                      <span className="kw-back-icon" aria-hidden="true" />
                      <span className="kw-back-label">Geri</span>
                    </button>
                  ) : null}
                  {!last ? (
                    <button
                      type="button"
                      className="btn btn-primary kw-next"
                      onClick={onNext}
                    >
                      Devam
                      <span className="arrow">→</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="karaoke-side" aria-label="Rezervasyon özeti">
            <div className="karaoke-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/photos/interior-chest.webp"
                alt="Köşkün üst katı"
                loading="lazy"
              />
            </div>

            <div className="karaoke-summary">
              <span className="eyebrow on-dark">
                {dayLabel(date, today, tomorrow)}
                {startHour !== null ? ` · ${hourLabel(startHour)}` : ""} ·{" "}
                {guests} kişi
              </span>
              <div className="karaoke-lines">
                <div>
                  <span>
                    Oda · {hours} saat
                    <span className="karaoke-unit">
                      {" "}
                      ({priceLabel(hourly)}/saat)
                    </span>
                  </span>
                  <span>{priceLabel(quote.priceMinor)}</span>
                </div>
                {discountPct > 0 && (
                  <div>
                    <span>
                      {tierLabel ?? "Üyelik"} indirimi %{discountPct}
                    </span>
                    <span className="karaoke-discount">
                      −{priceLabel(quote.discountMinor)}
                    </span>
                  </div>
                )}
                <div className="karaoke-total">
                  <span>Ödenecek toplam</span>
                  <span className="karaoke-total-n">
                    {priceLabel(quote.totalMinor)}
                  </span>
                </div>
              </div>
              <p className="karaoke-kdv">
                <KdvNote kdv={kdv} />
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
