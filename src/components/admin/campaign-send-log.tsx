import {
  CAMPAIGN_SENDS_LIMIT,
  listCampaignSends,
} from "@/lib/admin/campaign-sends";

import { CampaignSendTable } from "./campaign-send-table";
import { Card } from "./forms";

/**
 * "Kime gitti" - the campaign's send log, on screen.
 *
 * The detail page used to show three numbers and stop there, so "Gönderildi
 * 363 · Başarısız 37" named nobody: the operator could not answer a member
 * asking why they got the mail, or why they did not, and under 6563 the proof
 * is the sender's to produce. The rows have been written since the feature
 * shipped; this only reads them.
 *
 * A read that throws is caught here rather than left to the error boundary -
 * a send log that cannot be read must not take down the page that can still
 * queue, resume and preview the campaign.
 */
export async function CampaignSendLog({ campaignId }: { campaignId: string }) {
  let rows;
  try {
    rows = await listCampaignSends(campaignId);
  } catch (err) {
    console.error("[admin/kampanya] gönderim defteri okunamadı", err);
    return (
      <Card className="mt-4">
        <Heading />
        <p className="text-sm text-amber-700">
          Gönderim defteri şu an okunamadı. Sayfayı yenilemeyi dene.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <Heading />
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Bu kampanya henüz kuyruğa alınmadı; alıcı kaydı oluşmadı.
        </p>
      ) : (
        <CampaignSendTable
          rows={rows}
          truncated={rows.length >= CAMPAIGN_SENDS_LIMIT}
        />
      )}
    </Card>
  );
}

function Heading() {
  return (
    <h2
      className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
      style={{ fontFamily: "var(--mono), monospace" }}
    >
      Gönderim defteri
    </h2>
  );
}
