import { ExternalLink } from "lucide-react";
import type React from "react";
import { ButtonLink } from "@/features/site/button-link";
import { SectionHeading } from "@/features/site/section-heading";
import { siteLinks } from "@/features/site/site-links";
import { CopyButton } from "./copy-button";

/** The README's "Quick start from source (Local mode)", word for word. */
const quickStart = `pnpm install
pnpm cutroom setup                 # downloads the Kokoro voice model once (~90 MB)
ollama pull gemma4:e4b             # default model; see docs/decisions/0003
pnpm cutroom make --repo ./path/to/app --preset launch-editorial --ratios 16:9,9:16 --privacy local`;

export function RunItYourself(): React.ReactElement {
  return (
    <section aria-labelledby="run-heading" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <SectionHeading
        id="run-heading"
        title="Run it yourself"
        sub={
          <>
            Needs Node 22, pnpm 10, ffmpeg and Ollama. No GPU?{" "}
            <code className="font-mono text-ink">npx cutroom demo</code> films a sample repo with a scripted
            model.
          </>
        }
      />
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-xs text-ink-muted">Local quick start</span>
          <CopyButton text={quickStart} label="Copy the quick start commands" />
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink-muted">
          <code>{quickStart}</code>
        </pre>
      </div>
      <div className="mt-6 flex justify-center">
        <ButtonLink href={siteLinks.repository} tone="neutral">
          View on GitHub
          <ExternalLink className="size-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </section>
  );
}
