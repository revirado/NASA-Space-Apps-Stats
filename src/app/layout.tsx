import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { buildThemeCss } from "@/config/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Events Dashboard · NASA Space Apps 2026",
  description:
    "Live statistics of NASA Space Apps 2026 local events: world globe, rankings and capture history. Estadísticas de local events de NASA Space Apps 2026.",
  authors: [{ name: "ariellamas.tech", url: "https://ariellamas.tech" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Paleta centralizada (D18): única fuente de color, inyectada como variables CSS */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
        {children}
      </body>
    </html>
  );
}
