import type { Metadata } from "next";
import {
  DM_Sans,
  DM_Serif_Display,
  JetBrains_Mono,
  Marcellus,
  Pinyon_Script,
  Playfair_Display,
} from "next/font/google";

import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const pinyon = Pinyon_Script({
  subsets: ["latin"],
  variable: "--font-pinyon",
  weight: "400",
  display: "swap",
});

const marcellus = Marcellus({
  subsets: ["latin"],
  variable: "--font-marcellus",
  weight: "400",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "L'Affogato — Caffè · Gelato · Dolci · Maltepe Park, İstanbul",
    template: "%s · L'Affogato",
  },
  description:
    "L'Affogato — Bologna 1987'den İstanbul'a. Yenilebilir waffle kup içinde espresso ve gelato. Drink it. Eat the cup. Maltepe Park açık-hava teras.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

const fontVariables = [
  playfair.variable,
  dmSerif.variable,
  dmSans.variable,
  pinyon.variable,
  marcellus.variable,
  jetbrains.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
