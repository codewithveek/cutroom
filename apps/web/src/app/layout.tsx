import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutroom",
  description: "Turn a codebase into product videos, on open models.",
};

export default function RootLayout(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen">
        <TopBar />
        <main>{props.children}</main>
      </body>
    </html>
  );
}
