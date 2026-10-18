"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { useAuthStatus } from "@/lib/use-auth-status";
import { Section } from "./settings-section";

/** Email, password and sessions of the admin account; deployed instances only (E7-10). */
export function AccountSection(): React.ReactElement | null {
  const status = useAuthStatus();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [busy, setBusy] = useState(false);
  if (status?.mode !== "password" || !status.user) return null;
  const signedInAs = status.user.email;

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ tone: "ok", text: await action() });
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiClient.updateAccount({
        currentPassword,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(newPassword ? { newPassword } : {}),
      });
      setCurrentPassword("");
      setNewPassword("");
      return "Saved.";
    });
  };

  return (
    <Section
      id="account"
      title="Account"
      description={`Signed in as ${signedInAs}. The current password is needed for any change.`}
    >
      <form onSubmit={save} className="grid max-w-md gap-3">
        <div>
          <Label htmlFor="account-email" hint="optional">
            New email
          </Label>
          <TextInput
            id="account-email"
            type="email"
            autoComplete="username"
            placeholder={signedInAs}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="account-new-password" hint="optional, at least 12 characters">
            New password
          </Label>
          <TextInput
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="account-current-password">Current password</Label>
          <TextInput
            id="account-current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        {message ? (
          <p className={message.tone === "ok" ? "text-sm text-supported" : "text-sm text-unsupported"}>
            {message.text}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={busy || (!email.trim() && !newPassword)}>
            Save
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await apiClient.signOutOtherSessions();
                return "Signed out everywhere else.";
              })
            }
          >
            Sign out other sessions
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await apiClient.logout();
                window.location.assign("/login");
                return "Signed out.";
              })
            }
          >
            Sign out
          </Button>
        </div>
      </form>
    </Section>
  );
}
