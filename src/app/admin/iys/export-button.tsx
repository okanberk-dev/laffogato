"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { announceAdminChange, BUTTON, useToast } from "@/components/admin/ui";

/**
 * "İYS dosyasını indir": POSTs to the route handler (it writes: the events
 * go into a new batch), saves the CSV it answers, then re-reads the page so
 * the rows show "Dosyada" and the batch's "İYS'ye yüklendi" appears. A
 * fetch rather than a form post, so the page updates without a reload.
 */
export function IysExportButton({ count }: { count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/admin/iys/dosya", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 200);
        toast.show({
          message:
            text || "Dosya hazırlanamadı; sayfayı yenileyip tekrar dene.",
          tone: res.status === 409 ? "info" : "danger",
        });
        if (res.status === 409) router.refresh();
        return;
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(
          res.headers.get("content-disposition") ?? "",
        )?.[1] ?? "iys.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.show({
        message: `${res.headers.get("x-iys-count") ?? ""} kayıt dosyada (${name}). İYS Web'e yükledikten sonra bu sayfada "İYS'ye yüklendi" de.`,
        tone: "success",
      });
      announceAdminChange();
      router.refresh();
    } catch {
      toast.show({
        message: "Dosya indirilemedi; bağlantını kontrol edip tekrar dene.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={BUTTON.primary}
      onClick={download}
      disabled={busy || count === 0}
      aria-busy={busy}
    >
      {busy ? "Hazırlanıyor…" : `İYS dosyasını indir (${count})`}
    </button>
  );
}
