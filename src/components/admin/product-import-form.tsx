"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  applyProductImportAction,
  previewProductImportAction,
} from "@/app/admin/urunler/ice-aktar/actions";
import {
  EMPTY_IMPORT_STATE,
  IMPORT_NEED_LABEL,
  IMPORT_STATUS_LABEL,
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_MAX_ROWS,
  type ImportRowStatus,
  type ImportRowView,
  type ProductImportState,
} from "@/lib/admin/product-import-core";
import type { AdminTone } from "@/lib/admin/tone";

import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "./action-form";
import { Card } from "./forms";
import {
  announceAdminChange,
  Badge,
  BUTTON,
  DataTable,
  NUMERIC_STYLE,
  type DataTableColumn,
} from "./ui";

const STATUS_TONE: Record<ImportRowStatus, AdminTone> = {
  create: "info",
  update: "accent",
  unchanged: "neutral",
  error: "danger",
};

const STATUS_ORDER: readonly ImportRowStatus[] = [
  "create",
  "update",
  "unchanged",
  "error",
];

const HEADING = "text-lg font-semibold text-[var(--admin-text)]";

/**
 * The product CSV import, one form in three parts: the template and the
 * rules, the file and its dry run, then the preview with "İçe aktar".
 *
 * Posted by hand (useNoResetSubmit), so the chosen file stays in its field
 * between the preview and the import: the import sends the same file
 * again and the server plans it afresh, it never trusts rows coming back
 * from the page. Which button was pressed rides along as `intent`.
 */
export function ProductImportForm() {
  const [running, setRunning] = useState<"preview" | "apply">("preview");
  const [fileChanged, setFileChanged] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const [state, dispatch, pending] = useActionState(
    async (prev: ProductImportState, formData: FormData) => {
      const apply = formData.get("intent") === "apply";
      const next = await withPanelCatch<ProductImportState>(
        apply ? applyProductImportAction : previewProductImportAction,
        (p) => ({ ...p, error: PANEL_ACTION_FAILED }),
      )(prev, formData);
      setFileChanged(false);
      if (next.phase === "done") announceAdminChange();
      return next;
    },
    EMPTY_IMPORT_STATE,
  );

  const onSubmit = useNoResetSubmit(dispatch, pending, {
    beforeSubmit: (_form, submitter) => {
      setRunning(
        submitter?.getAttribute("value") === "apply" ? "apply" : "preview",
      );
    },
  });

  const rows = state.rows ?? [];
  const counts = state.counts;
  const writable = counts ? counts.create + counts.update : 0;
  const phase = state.phase === "done" ? "done" : "preview";
  const shown = onlyErrors ? rows.filter((r) => r.status === "error") : rows;

  const columns: DataTableColumn<ImportRowView>[] = [
    {
      key: "line",
      header: "Satır",
      cell: (r) => <span style={NUMERIC_STYLE}>{r.line}</span>,
    },
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span style={NUMERIC_STYLE}>{r.sku}</span>,
    },
    { key: "name", header: "Ad", cell: (r) => r.name || "-" },
    {
      key: "status",
      header: "Durum",
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} dot>
          {IMPORT_STATUS_LABEL[phase][r.status]}
        </Badge>
      ),
    },
    {
      key: "messages",
      header: "Ayrıntı",
      cell: (r) =>
        r.messages.length === 0 ? (
          <span className="text-[var(--admin-text-mute)]">-</span>
        ) : (
          <ul className="grid gap-0.5">
            {r.messages.map((m, i) => (
              <li
                key={i}
                className={
                  r.status === "error"
                    ? "text-[var(--admin-danger-ink)]"
                    : undefined
                }
              >
                {m}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <Card className="grid gap-4">
        <h2 className={HEADING}>1. Şablonu indir</h2>
        <p className="text-sm text-[var(--admin-text-soft)]">
          Başlık satırı ve bir örnek satırla gelir. Excel ya da Numbers&apos;ta
          aç, örneği silip ürünlerini yaz, &quot;CSV UTF-8&quot; olarak kaydet.
        </p>
        <div>
          <a
            href="/admin/urunler/ice-aktar/sablon"
            download
            className={BUTTON.ghost}
          >
            Şablonu indir (CSV)
          </a>
        </div>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm text-[var(--admin-text-soft)]">
          <li>
            Ürünü SKU bulur: panelde o SKU varsa ürün güncellenir, yoksa yeni
            ürün açılır. Aynı dosyayı ikinci kez yüklemek kopya açmaz, hiçbir
            şeyi değiştirmez.
          </li>
          <li>
            Görseller içe aktarılmaz. Yeni ürünün görselini sonra ürün
            sayfasından eklersin; yeni ürün, aktif demezsen pasif açılır.
          </li>
          <li>
            Dosyada olmayan sütun hiçbir şeyi değiştirmez. Boş bıraktığın ana
            alan (ad, kategori, fiyat, stok, durum, açıklama, etiket) olduğu
            gibi kalır; boş bıraktığın isteğe bağlı alan (eski fiyat, KDV,
            marka, ağırlık) temizlenir, üründe kayıtlı olan silinir. Önizleme
            bunları &quot;temizlenecek&quot; diye gösterir. Yalnız stok ya da
            fiyat güncelleyeceksen öteki sütunları dosyadan çıkar.
          </li>
          <li>
            Stok farkı Stok hareketlerinde &quot;CSV içe aktarma&quot; notuyla
            görünür. Varyantlı ürünün stoğu buradan değişmez.
          </li>
          <li>
            En fazla 1 MB ve {PRODUCT_IMPORT_MAX_ROWS} satır. Hücreler noktalı
            virgül ya da virgülle ayrılabilir; fiyatta 129,90 da 129.90 da
            olur.
          </li>
        </ul>
        <details className="rounded-xl border border-[var(--admin-border)] px-4 py-3">
          <summary className="min-h-[44px] cursor-pointer content-center text-sm font-medium text-[var(--admin-text)]">
            Sütunlar
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[var(--admin-text-soft)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Sütun</th>
                  <th className="py-2 pr-3 font-medium">Gerekli mi</th>
                  <th className="py-2 pr-3 font-medium">Örnek</th>
                  <th className="py-2 font-medium">Not</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_IMPORT_COLUMNS.map((c) => (
                  <tr
                    key={c.key}
                    className="border-t border-[var(--admin-border)] align-top"
                  >
                    <td className="py-2 pr-3" style={NUMERIC_STYLE}>
                      {c.key}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {IMPORT_NEED_LABEL[c.need]}
                    </td>
                    <td className="py-2 pr-3">{c.example}</td>
                    <td className="py-2 text-[var(--admin-text-soft)]">
                      {c.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <Card className="grid gap-4">
        <h2 className={HEADING}>2. Dosyayı seç ve önizle</h2>
        <label className="grid gap-2 text-sm text-[var(--admin-text-soft)]">
          CSV dosyası
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            required
            onChange={() => setFileChanged(true)}
            className="block w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-xl file:border file:border-[var(--admin-border-strong)] file:bg-[var(--admin-surface)] file:px-4 file:text-sm file:text-[var(--admin-text)]"
          />
        </label>
        <p className="text-xs text-[var(--admin-text-mute)]">
          Önizleme hiçbir şey yazmaz: her satırın ne olacağını gösterir.
        </p>
        <div>
          <button
            type="submit"
            name="intent"
            value="preview"
            disabled={pending}
            aria-busy={(pending && running === "preview") || undefined}
            className={BUTTON.primary}
          >
            {pending && running === "preview" ? "Okunuyor…" : "Önizle"}
          </button>
        </div>
        {state.error ? (
          <div
            role="alert"
            className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
          >
            {state.error}
          </div>
        ) : null}
      </Card>

      {state.phase !== "idle" && counts ? (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={HEADING}>
              {state.phase === "done" ? "3. Sonuç" : "3. Önizleme"}
            </h2>
            {state.fileName ? (
              <span
                className="text-xs text-[var(--admin-text-mute)]"
                style={NUMERIC_STYLE}
              >
                {state.fileName}
              </span>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="Satır sayıları">
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <Badge tone={STATUS_TONE[s]}>
                  {IMPORT_STATUS_LABEL[phase][s]}: {counts[s]}
                </Badge>
              </li>
            ))}
          </ul>

          {state.notices && state.notices.length > 0 ? (
            <ul
              role="status"
              className="grid gap-1 rounded-xl bg-[var(--admin-surface-2)] px-3.5 py-2.5 text-sm text-[var(--admin-text-soft)]"
            >
              {state.notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}

          {counts.error > 0 ? (
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-[var(--admin-text-soft)]">
              <input
                type="checkbox"
                checked={onlyErrors}
                onChange={(e) => setOnlyErrors(e.target.checked)}
                className="h-5 w-5 accent-[var(--admin-primary)]"
              />
              Yalnız hatalı satırları göster
            </label>
          ) : null}

          <DataTable
            columns={columns}
            rows={shown}
            rowKey={(r) => String(r.line)}
            caption={
              state.phase === "done"
                ? "İçe aktarmanın satır satır sonucu"
                : "Önizleme: her satırın ne olacağı"
            }
          />

          {state.phase === "preview" ? (
            <div className="grid gap-3 border-t border-[var(--admin-border)] pt-4">
              <input type="hidden" name="planHash" value={state.planHash ?? ""} />
              <p className="text-sm text-[var(--admin-text-soft)]">
                {writable > 0
                  ? `${writable} satır yazılacak. Hatalı ve değişmeyen satırlar atlanır.`
                  : "Yazılacak satır yok."}
              </p>
              {fileChanged ? (
                <p className="text-sm text-[var(--admin-danger-ink)]">
                  Dosyayı değiştirdin: önce yeniden önizle.
                </p>
              ) : null}
              <div>
                <button
                  type="submit"
                  name="intent"
                  value="apply"
                  disabled={pending || writable === 0 || fileChanged}
                  aria-busy={(pending && running === "apply") || undefined}
                  className={BUTTON.primary}
                >
                  {pending && running === "apply"
                    ? "İçe aktarılıyor…"
                    : `İçe aktar (${writable} satır)`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-4">
              <Link href="/admin/urunler" className={BUTTON.primary}>
                Ürünlere dön
              </Link>
              <Link href="/admin/stok-hareketleri" className={BUTTON.ghost}>
                Stok hareketleri
              </Link>
            </div>
          )}
        </Card>
      ) : null}
    </form>
  );
}
