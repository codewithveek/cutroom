import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

// Read per request: CUTROOM_DEMO_MODE is a runtime setting, not a build-time one.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Cutroom",
    description: "Turn a codebase into product videos, on open models.",
    // The demo is not the page to index; the landing site is (D-7).
    ...(process.env.CUTROOM_DEMO_MODE === "true" ? { robots: { index: false, follow: false } } : {}),
  };
}

export default function RootLayout(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <AppShell>{props.children}</AppShell>
      </body>
    </html>
  );
}
