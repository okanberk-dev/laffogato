import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Hukuki bilgiler · L'Affogato", template: "%s · L'Affogato" },
};

export default function HukukLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--bg-warm)", minHeight: "100vh" }}>{children}</div>;
}
