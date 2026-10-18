import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutroom",
  description: "Turn a codebase into product videos, on open models.",
};

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
