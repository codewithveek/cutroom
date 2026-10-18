"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/app-shell/logo-mark";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";

/** Only same-site paths: `?next=https://elsewhere` must not become an open redirect. */
export function safeNextPath(next: string | null): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** The sign-in page of a deployed instance (E7). Local installs never show it. */
export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiClient
      .authStatus()
      .then((status) => {
        if (status.mode === "none" || status.user) router.replace(next);
      })
      .catch(() => undefined);
  }, [router, next]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await apiClient.login({ email, password });
      router.replace(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 rounded-2xl p-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
          <div>
            <h1 className="text-base font-semibold tracking-tight">Sign in to Cutroom</h1>
            <p className="text-xs text-ink-muted">The admin account set when this instance was deployed.</p>
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <TextInput
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-unsupported">{error}</p> : null}
        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
