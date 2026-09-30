import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { EVENT } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans-brand" });

export const metadata: Metadata = {
  title: { default: `${EVENT.name} · ${EVENT.programme}`, template: `%s · ${EVENT.name} ${EVENT.short}` },
  description: `${EVENT.name} ${EVENT.programme} — buyer registration, verification, matchmaking and trade facilitation portal.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
