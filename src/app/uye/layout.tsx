import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Üyelik",
  robots: { index: false, follow: false },
};

export default function UyeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-warm)" }}>
      {children}
    </div>
  );
}
