import type React from "react";
import { ButtonLink } from "./button-link";
import { LogoMark } from "./logo-mark";
import { siteLinks } from "./site-links";

export function SiteNav(): React.ReactElement {
  const links = [
    { label: "Demo", href: siteLinks.demo },
    { label: "GitHub", href: siteLinks.repository },
    ...(siteLinks.devPost ? [{ label: "DEV post", href: siteLinks.devPost }] : []),
  ];
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
      <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <LogoMark className="size-7" />
        Cutroom
      </a>
      <nav aria-label="Main" className="hidden items-center gap-5 text-sm text-ink-muted sm:flex">
        {links.map((link) => (
          <a key={link.label} href={link.href} className="hover:text-ink">
            {link.label}
          </a>
        ))}
      </nav>
      <ButtonLink href={siteLinks.demo} tone="accent" className="ml-auto h-9 px-4">
        Try the demo
      </ButtonLink>
    </header>
  );
}
