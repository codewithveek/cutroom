"use client";

import type { ApiTokenSummaryView } from "@cutroom/scene-spec";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { useAuthStatus } from "@/lib/use-auth-status";
import { Section } from "./settings-section";

function describeToken(token: ApiTokenSummaryView): string {
  if (token.revokedAt) return `Revoked ${new Date(token.revokedAt).toLocaleDateString()}`;
  const used = token.lastUsedAt ? `last used ${new Date(token.lastUsedAt).toLocaleString()}` : "never used";
  const expiry = token.expiresAt ? ` · expires ${new Date(token.expiresAt).toLocaleDateString()}` : "";
  return `Created ${new Date(token.createdAt).toLocaleDateString()} · ${used}${expiry}`;
}

/** Tokens for the CLI, the GitHub Action and the remote render API (E7-7, E7-10). */
export function ApiTokensSection(): React.ReactElement | null {
  const status = useAuthStatus();
  const [tokens, setTokens] = useState<ApiTokenSummaryView[]>([]);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [created, setCreated] = useState<string>();
  const [error, setError] = useState<string>();
  const signedIn = status?.mode === "password" && Boolean(status.user);

  const refresh = useCallback(() => {
    apiClient
      .listApiTokens()
      .then((response) => setTokens(response.tokens))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);
  useEffect(() => {
    if (signedIn) refresh();
  }, [signedIn, refresh]);
  if (!signedIn) return null;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    try {
      const days = Number.parseInt(expiresInDays, 10);
      const response = await apiClient.createApiToken({
        name: name.trim(),
        ...(Number.isFinite(days) && days > 0 ? { expiresInDays: days } : {}),
      });
      setCreated(response.token);
      setName("");
      setExpiresInDays("");
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const revoke = async (tokenId: string) => {
    setError(undefined);
    try {
      await apiClient.revokeApiToken(tokenId);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Section
      id="api-tokens"
      title="API tokens"
      description="For the CLI, the GitHub Action and Hybrid renders: sent as Authorization: Bearer. A token is shown once."
    >
      <form
        onSubmit={create}
        className="grid max-w-md gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end"
      >
        <div>
          <Label htmlFor="token-name">Name</Label>
          <TextInput
            id="token-name"
            required
            maxLength={80}
            placeholder="GitHub Action"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="token-expiry" hint="days">
            Expires
          </Label>
          <TextInput
            id="token-expiry"
            type="number"
            min={1}
            max={365}
            placeholder="never"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Create
        </Button>
      </form>
      {created ? (
        <div className="mt-3 max-w-md rounded-xl border border-line bg-panel p-3.5">
          <div className="text-xs text-ink-muted">Copy it now; it is not shown again.</div>
          <code className="mt-1.5 block break-all font-mono text-xs">{created}</code>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-unsupported">{error}</p> : null}
      <ul className="mt-4 max-w-md space-y-2">
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{token.name}</div>
              <p className="mt-0.5 text-xs text-ink-muted">{describeToken(token)}</p>
            </div>
            {token.revokedAt ? null : (
              <Button size="sm" variant="danger" onClick={() => void revoke(token.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
        {tokens.length === 0 ? <li className="text-sm text-ink-faint">No tokens yet.</li> : null}
      </ul>
    </Section>
  );
}
