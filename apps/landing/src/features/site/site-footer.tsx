import type React from "react";
import { siteLinks } from "./site-links";

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:px-6">
        <p>© Cutroom · MIT licence</p>
        <nav aria-label="Footer" className="flex gap-4">
          <a href={siteLinks.repository} className="hover:text-ink">
            GitHub
          </a>
          {siteLinks.devPost ? (
            <a href={siteLinks.devPost} className="hover:text-ink">
              DEV post
            </a>
          ) : null}
        </nav>
        <p className="sm:ml-auto">
          Visual styles adapted from the{" "}
          <a href={siteLinks.productVideosSkill} className="text-ink underline-offset-4 hover:underline">
            product-videos skill
          </a>{" "}
          (MIT).
        </p>
      </div>
    </footer>
  );
}
