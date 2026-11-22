import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  KeyValueGrid,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import {
  BUDGET_OPTIONS,
  EXPERIENCE_OPTIONS,
  FRANCHISE_RETENTION_MONTHS,
  FRANCHISE_STATUS_LABELS,
  franchiseOptionLabel,
  LOCATION_OPTIONS,
  TIMELINE_OPTIONS,
} from "@/lib/franchise/franchise-core";
import { getFranchiseApplication } from "@/lib/franchise/store";

import {
  FRANCHISE_PATH,
  FRANCHISE_STATUS_TONES,
  FranchiseStatusButtons,
} from "../franchise-actions-ui";

export const metadata = { title: "Admin · Franchise başvurusu" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ID_RE = /^frn-\d{4,}$/;

/** The day the retention run deletes a row created at `iso`. */
function deletesOn(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  return formatDateTime(new Date(at + 365 * 86_400_000).toISOString());
}

/**
 * One application: who, where, the five answers, the note, and the KVKK
 * notice the applicant ticked (when, from where, which version). Status
 * buttons and "Sil" on top.
 */
export default async function FranchiseApplicationPage({ params }: PageProps) {
  await requireRole("leads");
  const { id } = await params;
  const app = ID_RE.test(id) ? await getFranchiseApplication(id) : null;
  if (!app) notFound();

  const contact: KeyValueItem[] = [
    { label: "Ad soyad", value: app.name },
    {
      label: "E-posta",
      value: (
        <a
          className="break-all underline underline-offset-4"
          href={`mailto:${app.email}`}
        >
          {app.email}
        </a>
      ),
    },
    {
      label: "Telefon",
      value: (
        <a
          className="underline underline-offset-4"
          href={`tel:${app.phone.replace(/[^\d+]/g, "")}`}
        >
          {app.phone}
        </a>
      ),
    },
    { label: "İl", value: app.city },
    { label: "İlçe", value: app.district },
  ];

  const answers: KeyValueItem[] = [
    {
      label: "Yer",
      value: franchiseOptionLabel(LOCATION_OPTIONS, app.locationStatus),
    },
    {
      label: "Yatırım aralığı",
      value: franchiseOptionLabel(BUDGET_OPTIONS, app.budget),
    },
    {
      label: "Deneyim",
      value: franchiseOptionLabel(EXPERIENCE_OPTIONS, app.experience),
    },
    {
      label: "Başlangıç",
      value: franchiseOptionLabel(TIMELINE_OPTIONS, app.timeline),
    },
    {
      label: "Not",
      value: app.message ? (
        <span className="whitespace-pre-wrap">{app.message}</span>
      ) : (
        ""
      ),
      full: true,
    },
  ];

  const consent: KeyValueItem[] = [
    {
      label: "Onay zamanı",
      value: app.consent?.at ? formatDateTime(app.consent.at) : "",
      hint: "İstanbul saatiyle.",
    },
    { label: "IP", value: app.consent?.ip ?? "", mono: true },
    { label: "Metin sürümü", value: app.consent?.version ?? "", mono: true },
    {
      label: "Silinme",
      value: deletesOn(app.createdAt),
      hint: `Başvurudan ${FRANCHISE_RETENTION_MONTHS} ay sonra, günlük imha işiyle.`,
    },
  ];

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-4xl">
      <BackLink href={FRANCHISE_PATH}>Franchise başvuruları</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div className={EYEBROW} style={MONO_STYLE}>
          Franchise başvurusu · {app.id}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-text)] sm:text-3xl">
          {app.name}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-text-soft)]">
          <Badge tone={FRANCHISE_STATUS_TONES[app.status]} dot>
            {FRANCHISE_STATUS_LABELS[app.status]}
          </Badge>
          {formatDateTime(app.createdAt)} tarihinde geldi.
        </p>
        <FranchiseStatusButtons app={app} />
      </header>

      <div className="grid gap-6">
        <Section title="Başvuran">
          <KeyValueGrid items={contact} />
        </Section>
        <Section title="Yanıtlar">
          <KeyValueGrid items={answers} />
        </Section>
        <Section title="Aydınlatma onayı">
          <KeyValueGrid items={consent} />
        </Section>
      </div>
    </main>
  );
}
