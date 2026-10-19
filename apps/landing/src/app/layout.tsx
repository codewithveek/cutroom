import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type React from "react";
import { siteCopy, siteLinks } from "@/features/site/site-links";
import "./globals.css";

const ogImage = { url: "/media/og-image.jpg", width: 1200, height: 630, alt: "Cutroom's launch video" };

export const metadata: Metadata = {
  metadataBase: new URL(siteLinks.site),
  title: siteCopy.title,
  description: siteCopy.heroSub,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Cutroom",
    title: siteCopy.title,
    description: siteCopy.heroSub,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteCopy.title,
    description: siteCopy.heroSub,
    images: [ogImage.url],
  },
};

export const viewport: Viewport = { themeColor: "#0b0b0c", colorScheme: "dark" };

export default function RootLayout(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">{props.children}</body>
    </html>
  );
}
