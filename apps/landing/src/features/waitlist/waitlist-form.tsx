"use client";

import { Check, Loader2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { MAX_EMAIL_LENGTH, waitlistResponseSchema } from "./waitlist-contracts";

type FormState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "joined" }
  | { kind: "failed"; message: string };

async function submitSignup(form: HTMLFormElement): Promise<FormState> {
  const data = new FormData(form);
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: data.get("email"), website: data.get("website") || undefined }),
  });
  const parsed = waitlistResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success && "ok" in parsed.data) return { kind: "joined" };
  return {
    kind: "failed",
    message: parsed.success && "error" in parsed.data ? parsed.data.error.message : "Something went wrong.",
  };
}

export function WaitlistForm(): React.ReactElement {
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ kind: "sending" });
    setState(
      await submitSignup(event.currentTarget).catch(
        () => ({ kind: "failed", message: "Check your connection and try again." }) as const,
      ),
    );
  };

  if (state.kind === "joined")
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-supported">
        <Check className="size-5" aria-hidden="true" />
        You're on the list.
      </p>
    );

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mx-auto max-w-md space-y-3"
      noValidate={false}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          maxLength={MAX_EMAIL_LENGTH}
          autoComplete="email"
          placeholder="you@company.com"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-panel px-4 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
        >
          {state.kind === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Join the waitlist
        </button>
      </div>
      {/* The honeypot (L-3): off-screen and out of the tab order, so only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="waitlist-website">Website</label>
        <input id="waitlist-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.kind === "failed" ? (
        <p role="alert" className="text-center text-sm text-unsupported">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
