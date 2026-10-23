"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/admin/forms";

import { CameraScanner } from "./camera-scanner";
import { beep } from "./scan-engine";
import { redeemCounterTokenAction, type TillState } from "./actions";

type Tab = "camera" | "code";

/**
 * Two ways in, both the member's own single-use code. The address tab went
 * on 21 Ekim 2026 (decision ASK-LOYALTY): a typed address named a member
 * who showed nothing. A member whose QR will not scan reads out the eight
 * characters under it.
 */
const TABS: { id: Tab; label: string }[] = [
  { id: "camera", label: "Kamera ile okut" },
  { id: "code", label: "Kodu yaz" },
];

/** Under the code tab: what to do when the camera cannot read the QR. */
const CODE_HINT =
  "QR okunmuyorsa üyeden kodun altındaki 8 karakteri söylemesini iste.";

const STAMP_CHOICES = [1, 2, 3, 4, 5];

/**
 * The answer when the action itself failed on the way back (a dropped
 * connection, a crash after the write): the stamps may be in. The server's
 * own partial answer says the same (`COUNTER_MAYBE_STAMPED`,
 * lib/mobile/counter.ts).
 */
const MAYBE_STAMPED = "Damga verilmiş olabilir, üyenin kartını kontrol et.";

/**
 * The till desk: one action, two ways in (spec §5).
 *
 * The camera and the eight-character code end in the same server action, so
 * a shift that falls back to typing gives exactly the same stamps, the same
 * ledger note and the same receipt on screen.
 */
export function TillConsole() {
  const [tab, setTab] = useState<Tab>("camera");
  const [stamps, setStamps] = useState(1);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<TillState>({});
  const [pending, startTransition] = useTransition();
  // A receipt, or an answer that says something may have been given: the
  // same submit must not go again until "Yeni işlem" (admin audit ORD-13).
  const settled = Boolean(state.result) || Boolean(state.partial);

  /**
   * The last scanned value and how it ended, handed back to the scanner so
   * its gate can either retire the code for good or make it scannable again.
   */
  const [outcome, setOutcome] = useState<{
    value: string;
    redeemed: boolean;
  } | null>(null);
  const scannedRef = useRef("");

  // The scan loop holds `onScan` across renders; a stable identity keeps it
  // from tearing the camera down every time a stamp count changes, so the
  // two values it needs are read through refs rather than closed over.
  const stampsRef = useRef(stamps);
  const noteRef = useRef(note);
  useEffect(() => {
    stampsRef.current = stamps;
    noteRef.current = note;
  }, [stamps, note]);

  const onScan = useCallback((value: string) => {
    scannedRef.current = value;
    setOutcome(null);
    startTransition(async () => {
      let next: TillState;
      try {
        next = await redeemCounterTokenAction({
          kind: "token",
          value,
          stamps: stampsRef.current,
          note: noteRef.current,
        });
      } catch {
        // Unanswered: the code may already be burned and the stamps in. A
        // throw used to open the panel's error page (ORD-12).
        next = { error: MAYBE_STAMPED, partial: true };
      }
      setState(next);
      // A code the server consumed must never be offered again (a partial
      // answer consumed it too); one refused before that must be retryable
      // without leaving the tab.
      setOutcome({
        value,
        redeemed: Boolean(next.result) || Boolean(next.partial),
      });
      if (next.error) beep(false);
    });
  }, []);

  // Set at the click, before `pending` renders: a double Enter is one post.
  const busy = useRef(false);

  function submit(value: string) {
    if (busy.current || pending || settled) return;
    busy.current = true;
    startTransition(async () => {
      let next: TillState;
      try {
        next = await redeemCounterTokenAction({
          kind: "code",
          value,
          stamps,
          note,
        });
      } catch {
        next = { error: MAYBE_STAMPED, partial: true };
      } finally {
        busy.current = false;
      }
      setState(next);
      // Given, or maybe given: the field empties so Enter cannot send it
      // again. A plain refusal keeps it for the correction.
      if (next.result || next.partial) setCode("");
    });
  }

  const clearResult = useCallback(() => {
    setState({});
    setOutcome(null);
    scannedRef.current = "";
  }, []);

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                clearResult();
                setTab(t.id);
              }}
              aria-pressed={tab === t.id}
              className={`min-h-11 rounded-lg border px-4 py-2 text-sm transition-colors pointer-fine:min-h-9 ${
                tab === t.id
                  ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white"
                  : "border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Damga" hint="Kaç damga düşecek (1-5).">
            <Select
              value={String(stamps)}
              onChange={(e) => setStamps(Number(e.target.value))}
            >
              {STAMP_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n} damga
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Not (isteğe bağlı)" hint="Damga geçmişinde görünür.">
            <TextInput
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cappuccino + cheesecake"
            />
          </Field>
        </div>
      </Card>

      {tab === "camera" && (
        <Card>
          {/* Mounted only while the tab is open: the stream, the decode loop
              and the torch all die with the component, which is the only
              teardown that cannot be got wrong. */}
          <CameraScanner
            onScan={onScan}
            paused={pending || Boolean(state.result) || Boolean(state.error)}
            outcome={outcome}
            onResume={clearResult}
          />
        </Card>
      )}

      {tab === "code" && (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            // React's guard against the browser's own GET; onSubmit posts.
            action={() => submit(code)}
            onSubmit={(e) => {
              e.preventDefault();
              submit(code);
            }}
          >
            <Field label="Kod" hint="Üyenin kartında yazan 8 karakter.">
              <TextInput
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="K7P42M9X"
                style={{ fontFamily: "var(--mono), monospace" }}
              />
            </Field>
            <PrimaryButton type="submit" disabled={pending || settled}>
              {pending ? "Veriliyor…" : "Damga ver"}
            </PrimaryButton>
          </form>
          <p className="mt-3 text-xs text-[var(--admin-text-mute)]">
            {CODE_HINT}
          </p>
        </Card>
      )}

      {state.error && (
        <Card>
          <p role="alert" className="text-sm text-[var(--admin-danger)]">
            {state.error}
          </p>
          <div className="mt-3">
            <GhostButton type="button" onClick={clearResult}>
              {state.partial ? "Yeni işlem" : "Tamam"}
            </GhostButton>
          </div>
        </Card>
      )}

      {state.result && <Receipt result={state.result} onNext={clearResult} />}
    </div>
  );
}

function Receipt({
  result,
  onNext,
}: {
  result: NonNullable<TillState["result"]>;
  onNext: () => void;
}) {
  return (
    <Card className="grid gap-3 border-[var(--admin-success)]/30 bg-[var(--admin-success-soft)]">
      <p className="text-sm text-[var(--admin-success)]">
        <strong>+{result.stampsGiven} damga</strong> verildi.
      </p>
      <div className="grid gap-1 text-sm text-[var(--admin-text)]">
        {result.name && <p>{result.name}</p>}
        <p style={{ fontFamily: "var(--mono), monospace" }}>
          {result.memberLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        <Stat label="Kart" value={`${result.stamps} / ${result.stampTarget}`} />
        <Stat label="Hazır ödül" value={String(result.rewardsReady)} />
        {result.code && <Stat label="Kod" value={result.code} />}
      </div>
      {result.rewardsReady > 0 && (
        <p className="text-xs text-[var(--admin-success)]">
          Üyenin ücretsiz içeceği hazır - uygulamadaki Ödüller sekmesinden
          kuponunu alabilir.
        </p>
      )}
      <div>
        <GhostButton type="button" onClick={onNext}>
          Yeni işlem
        </GhostButton>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
      <div className="text-[11px] font-medium text-[var(--admin-text-mute)]">
        {label}
      </div>
      <div
        className="mt-0.5 text-base text-[var(--admin-text)]"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {value}
      </div>
    </div>
  );
}
