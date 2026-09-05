"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/admin/forms";

import { redeemCounterTokenAction, type TillState } from "./actions";

/**
 * `BarcodeDetector` is a browser API without a TypeScript lib definition yet.
 * Only the two members used here are declared: a wider hand-written shim would
 * be a second, drifting copy of a spec this file does not own.
 */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type Tab = "camera" | "code" | "email";

const TABS: { id: Tab; label: string }[] = [
  { id: "camera", label: "Kamera ile okut" },
  { id: "code", label: "Kodu yaz" },
  { id: "email", label: "E-posta ile" },
];

const STAMP_CHOICES = [1, 2, 3, 4, 5];

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector ?? null
  );
}

/**
 * The till desk: one action, three ways in (spec §5).
 *
 * The camera, the eight-character code and the member's address all end in the
 * same server action, so a shift that falls back to typing gives exactly the
 * same stamps, the same ledger note and the same receipt on screen.
 */
export function TillConsole() {
  const [tab, setTab] = useState<Tab>("camera");
  const [stamps, setStamps] = useState(1);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<TillState>({});
  const [pending, startTransition] = useTransition();

  // Resolved on the client only: rendering "desteklemiyor" on the server and
  // "hazır" after hydration would be a mismatch.
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScanRef = useRef("");
  // The scan loop must read today's stamp count without being torn down and
  // restarted — remounting the camera every time the cashier changes "2 damga"
  // would drop the stream mid-queue.
  const stampsRef = useRef(stamps);
  const noteRef = useRef(note);

  function submit(kind: string, value: string) {
    startTransition(async () => {
      setState(await redeemCounterTokenAction({ kind, value, stamps, note }));
    });
  }

  useEffect(() => {
    stampsRef.current = stamps;
    noteRef.current = note;
  }, [stamps, note]);

  useEffect(() => {
    setSupport(barcodeDetector() ? "yes" : "no");
  }, []);

  useEffect(() => {
    if (tab !== "camera" || support !== "yes") return;
    const video = videoRef.current;
    const Ctor = barcodeDetector();
    if (!video || !Ctor) return;

    const detector = new Ctor({ formats: ["qr_code"] });
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setCameraError("");
        timer = setInterval(() => {
          void detector
            .detect(video)
            .then((found) => {
              const raw = found[0]?.rawValue?.trim() ?? "";
              // The same QR sits in front of the lens for many frames; one
              // scan must not spend the token five times.
              if (!raw || raw === lastScanRef.current) return;
              lastScanRef.current = raw;
              startTransition(async () => {
                setState(
                  await redeemCounterTokenAction({
                    kind: "token",
                    value: raw,
                    stamps: stampsRef.current,
                    note: noteRef.current,
                  }),
                );
              });
            })
            .catch(() => {
              // A frame that cannot be decoded is the normal case, not an error.
            });
        }, 400);
      } catch {
        setCameraError(
          "Kameraya erişilemedi. Tarayıcı iznini ver ya da kodu elle yaz.",
        );
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [tab, support, startTransition]);

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                lastScanRef.current = "";
                setTab(t.id);
              }}
              aria-pressed={tab === t.id}
              className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm transition-colors ${
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
          <Field label="Damga" hint="Kaç damga düşecek (1–5).">
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
          <Field label="Not (opsiyonel)" hint="Damga geçmişinde görünür.">
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
        <Card className="grid gap-3">
          {support === "no" ? (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Bu cihazın tarayıcısı QR okumayı desteklemiyor. Üyenin kartındaki
              8 karakterlik kodu <strong>Kodu yaz</strong> sekmesine gir.
            </p>
          ) : (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full rounded-xl border border-[var(--admin-border)] bg-black"
                style={{ maxHeight: 320 }}
              />
              <p className="text-xs text-[var(--admin-text-mute)]">
                Üyenin telefonundaki QR kodunu kameraya göster; okunduğunda
                damga kendiliğinden düşer.
              </p>
              {cameraError && (
                <p role="alert" className="text-xs text-[var(--admin-danger)]">
                  {cameraError}
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {tab === "code" && (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              submit("code", code);
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
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Veriliyor…" : "Damga ver"}
            </PrimaryButton>
          </form>
        </Card>
      )}

      {tab === "email" && (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              submit("email", email);
            }}
          >
            <Field
              label="Üye e-postası"
              hint="Üye QR'ını açamıyorsa bu yol kalır."
            >
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="uye@ornek.com"
              />
            </Field>
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Veriliyor…" : "Damga ver"}
            </PrimaryButton>
          </form>
        </Card>
      )}

      {state.error && (
        <Card>
          <p role="alert" className="text-sm text-[var(--admin-danger)]">
            {state.error}
          </p>
          <div className="mt-3">
            <GhostButton
              type="button"
              onClick={() => {
                lastScanRef.current = "";
                setState({});
              }}
            >
              Tamam
            </GhostButton>
          </div>
        </Card>
      )}

      {state.result && <Receipt result={state.result} />}
    </div>
  );
}

function Receipt({ result }: { result: NonNullable<TillState["result"]> }) {
  return (
    <Card className="grid gap-3 border-emerald-200 bg-emerald-50/60">
      <p className="text-sm text-emerald-800">
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
        <p className="text-xs text-emerald-800">
          Üyenin ücretsiz içeceği hazır — uygulamadaki Ödüller sekmesinden
          kuponunu alabilir.
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
      <div
        className="text-[9px] tracking-[0.18em] text-[var(--admin-text-mute)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
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
