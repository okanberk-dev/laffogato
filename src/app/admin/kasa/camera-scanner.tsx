"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { GhostButton } from "@/components/admin/forms";

import {
  beep,
  CAMERA_FAULT_MESSAGE,
  cameraFault,
  createDecoder,
  DECODE_SIZE,
  reticleSize,
  ScanGate,
  scanRegion,
  setTorch,
  torchCapable,
  type CameraFault,
  type Decoder,
  type DecoderKind,
} from "./scan-engine";

/** Remembered per till so a shift does not re-pick the camera every morning. */
const CAMERA_KEY = "laffogato.till.cameraId";

type Status = "idle" | "starting" | "scanning" | "fault";

interface CameraOption {
  id: string;
  label: string;
}

/**
 * The camera half of the till desk.
 *
 * Its own file, and its own mount lifecycle: everything here - a MediaStream,
 * a decode loop, a canvas, a torch - has to be torn down exactly when the
 * cashier leaves the tab, and the surest way to get that right is for the tab
 * switch to unmount the component that owns them.
 *
 * What changed, and why each thing was worth changing:
 *
 * - **It works in Safari now.** `BarcodeDetector` is Chromium-only, so an
 *   iPad - the likeliest till there is - used to be told its browser could
 *   not read QR at all. `createDecoder()` falls back to jsQR.
 * - **It decodes a crop, not the frame.** The reticle is not decoration: the
 *   square it draws lies inside the region handed to the decoder (sized from
 *   the picture on screen, `reticleSize`), downscaled to a fixed 480px. Less
 *   work per attempt, and no locking onto a poster behind the member.
 * - **It reads every frame the camera produces**, via
 *   `requestVideoFrameCallback`, instead of sampling on a 400 ms timer that
 *   could sit between two good frames.
 * - **It says what actually went wrong** - no permission, no camera, camera
 *   busy - instead of one sentence about browser permissions for all three.
 * - **It stops on success.** A scan that landed leaves the stream running in
 *   the old console, pointed at a code it will refuse for the next two
 *   minutes; here the camera stops, the receipt is read, and "Yeni okuma"
 *   starts the next member.
 */
export function CameraScanner({
  onScan,
  paused,
  outcome,
  onResume,
}: {
  /** Hands the decoded value up; the console owns the redeem. */
  onScan: (value: string) => void;
  /** True while a redeem is in flight or its receipt is on screen. */
  paused: boolean;
  /**
   * How the last handed-up value ended. `null` while one is still in flight.
   * A consumed code is never offered again; a failed one becomes scannable
   * the moment the lens sees it, with no tab dance in between.
   */
  outcome: { value: string; redeemed: boolean } | null;
  onResume: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gateRef = useRef(new ScanGate());
  const trackRef = useRef<MediaStreamTrack | null>(null);
  // The loop closes over these; refs so a change never restarts the stream.
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);

  const [status, setStatus] = useState<Status>("idle");
  const [fault, setFault] = useState<CameraFault>("other");
  const [decoder, setDecoder] = useState<DecoderKind | null>(null);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  /**
   * Read once, lazily, rather than in an effect: the picker below only
   * renders after `enumerateDevices` has answered on the client, so the
   * server's empty string is never part of the hydrated markup.
   */
  const [cameraId, setCameraId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(CAMERA_KEY) ?? "";
    } catch {
      /* Private mode; the default camera is fine. */
      return "";
    }
  });
  const [torch, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [flash, setFlash] = useState(false);
  /** Bumped to restart the camera effect; setting state to its own value would not. */
  const [attempt, setAttempt] = useState(0);
  /** The frame's side in CSS px (`reticleSize`); 0 until the video has a size. */
  const [reticle, setReticle] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
    onScanRef.current = onScan;
  }, [paused, onScan]);

  // The frame follows the box and the picture: a resize, a rotated iPad, a
  // camera switched to one with another shape.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const measure = () => {
      const rect = video.getBoundingClientRect();
      setReticle(
        reticleSize(
          { width: rect.width, height: rect.height },
          { width: video.videoWidth, height: video.videoHeight },
        ),
      );
    };
    video.addEventListener("loadedmetadata", measure);
    video.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(video);
    return () => {
      video.removeEventListener("loadedmetadata", measure);
      video.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!outcome) return;
    if (outcome.redeemed) gateRef.current.burn(outcome.value);
    else gateRef.current.forget(outcome.value);
  }, [outcome]);

  /** Flash the reticle green and beep - the cashier is looking at the member. */
  const confirm = useCallback(() => {
    setFlash(true);
    beep(true);
    window.setTimeout(() => setFlash(false), 450);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let frameHandle = 0;
    let decode: Decoder | null = null;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = DECODE_SIZE;
    canvas.height = DECODE_SIZE;

    const readFrame = async () => {
      if (stopped || !ctx || !decode) return;
      // A redeem is in flight or its receipt is up: keep the preview alive so
      // the cashier can aim the next member, but do not decode.
      if (pausedRef.current) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      const region = scanRegion(w, h);
      ctx.drawImage(
        video,
        region.sx,
        region.sy,
        region.size,
        region.size,
        0,
        0,
        DECODE_SIZE,
        DECODE_SIZE,
      );
      try {
        const frame = ctx.getImageData(0, 0, DECODE_SIZE, DECODE_SIZE);
        const value = await decode.decode(frame, canvas);
        if (stopped || pausedRef.current) return;
        if (gateRef.current.accept(value, Date.now())) {
          confirm();
          onScanRef.current(value);
        }
      } catch {
        // An undecodable frame is the normal case, not an error.
      }
    };

    /**
     * One pass per frame the camera actually delivers where the browser can
     * say so, and a 250 ms timer where it cannot. `rVFC` is the better half
     * of the deal: it never runs twice on the same picture and never sits
     * idle between two good ones.
     */
    const loop = () => {
      const rvfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback;
      if (rvfc) {
        const step = () => {
          if (stopped) return;
          void readFrame().finally(() => {
            if (!stopped) frameHandle = rvfc.call(video, step);
          });
        };
        frameHandle = rvfc.call(video, step);
      } else {
        timer = setInterval(() => void readFrame(), 250);
      }
    };

    void (async () => {
      setStatus("starting");
      try {
        decode = await createDecoder();
        if (stopped) return;
        setDecoder(decode.kind);

        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId
            ? { deviceId: { exact: cameraId } }
            : {
                facingMode: "environment",
                // Asked for, not required: a camera that cannot do this hands
                // back what it has rather than failing the whole request.
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        setCanTorch(torchCapable(track));

        // Labels are only populated after permission is granted, which is why
        // this runs here rather than on mount.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!stopped) {
          setCameras(
            devices
              .filter((d) => d.kind === "videoinput")
              .map((d, i) => ({
                id: d.deviceId,
                label: d.label || `Kamera ${i + 1}`,
              })),
          );
        }

        setStatus("scanning");
        loop();
      } catch (err) {
        if (stopped) return;
        setFault(cameraFault(err));
        setStatus("fault");
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      const cancel = (
        video as HTMLVideoElement & {
          cancelVideoFrameCallback?: (h: number) => void;
        }
      ).cancelVideoFrameCallback;
      if (frameHandle && cancel) cancel.call(video, frameHandle);
      // The torch is a physical LED: leaving it on would keep it lit after
      // the tab is gone, until the track is collected.
      void setTorch(trackRef.current, false).catch(() => {});
      trackRef.current = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [cameraId, attempt, confirm]);

  const pickCamera = (id: string) => {
    setCameraId(id);
    gateRef.current.clear();
    try {
      localStorage.setItem(CAMERA_KEY, id);
    } catch {
      /* Private mode; the choice lasts this session only. */
    }
  };

  const toggleTorch = () => {
    const next = !torch;
    setTorchOn(next);
    void setTorch(trackRef.current, next).catch(() => setTorchOn(!next));
  };

  // The fault answer takes the scanner's place, but the scanner stays
  // mounted (hidden): returned on its own, the answer unmounted the video
  // and the canvas, so "Yeniden dene" re-ran the camera effect with no
  // element to attach to and the till stayed on the fault for good.
  const faulted = status === "fault";

  return (
    <div className="grid gap-3">
      {faulted ? (
        <div className="grid gap-3">
          <p role="alert" className="text-sm text-[var(--admin-danger-ink)]">
            {CAMERA_FAULT_MESSAGE[fault]}
          </p>
          <div>
            <GhostButton type="button" onClick={() => setAttempt((n) => n + 1)}>
              Yeniden dene
            </GhostButton>
          </div>
        </div>
      ) : null}
      <div className={faulted ? "hidden" : "grid gap-3"}>
        <div className="relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="block w-full"
            style={{ maxHeight: 340, objectFit: "cover" }}
          />
          {/* The decoded square as it lands on screen (scan-engine.ts:
            `reticleSize`), so whatever is inside the frame is read. Until
            the video has a size, the old 78%-wide guess. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              data-reticle
              className="rounded-2xl border-4 transition-colors duration-150"
              style={{
                ...(reticle > 0
                  ? { width: reticle, height: reticle }
                  : { width: "78%", aspectRatio: "1 / 1" }),
                borderColor: flash
                  ? "rgb(16 185 129)"
                  : "rgba(255,255,255,0.85)",
                boxShadow: flash
                  ? "0 0 0 9999px rgba(16,185,129,0.18)"
                  : "0 0 0 9999px rgba(0,0,0,0.35)",
              }}
            />
          </div>
          {paused ? (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-xs text-white">
              Okuma duraklatıldı - sonuç ekranda.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canTorch && (
            <GhostButton
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch}
            >
              {torch ? "Işığı kapat" : "Işığı aç"}
            </GhostButton>
          )}
          {paused && (
            <GhostButton type="button" onClick={onResume}>
              Yeni okuma
            </GhostButton>
          )}
          {cameras.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-[var(--admin-text-soft)]">
              <span>Kamera</span>
              <select
                value={cameraId}
                onChange={(e) => pickCamera(e.target.value)}
                className="min-h-[36px] rounded-lg border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-2 py-1 text-xs"
              >
                <option value="">Otomatik (arka)</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <p className="text-xs text-[var(--admin-text-mute)]">
          {status === "starting"
            ? "Kamera açılıyor…"
            : "Üyenin telefonundaki QR'ı çerçevenin içine tut; okunduğunda damga kendiliğinden düşer."}
          {decoder === "js" && status === "scanning" ? (
            <>
              {" "}
              Bu tarayıcıda okuma yazılımla yapılıyor; ekran parlaklığını
              açtırmak okumayı hızlandırır.
            </>
          ) : null}
        </p>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
