import type { PrivacyMode } from "@cutroom/scene-spec";

export type NetworkScope = "none" | "localhost" | "external";
export type ProviderRole = "model" | "voice" | "embedding" | "research" | "render-upload";

export class PrivacyViolationError extends Error {
  override readonly name = "PrivacyViolationError";
  readonly mode: PrivacyMode;
  readonly providerId: string;
  readonly networkScope: NetworkScope;

  constructor(options: {
    mode: PrivacyMode;
    providerId: string;
    role: ProviderRole;
    networkScope: NetworkScope;
  }) {
    super(
      `${options.providerId} (${options.role}) needs ${options.networkScope} network access, which ${options.mode} mode does not allow.`,
    );
    this.mode = options.mode;
    this.providerId = options.providerId;
    this.networkScope = options.networkScope;
  }
}

export interface PrivacyOptIns {
  /** Hybrid only: the user agreed to send narration text (never code) to ElevenLabs. */
  externalVoice?: boolean;
}

export interface ProviderDeclaration {
  providerId: string;
  role: ProviderRole;
  networkScope: NetworkScope;
}

/**
 * Local: nothing leaves the machine. Hybrid: analysis stays local; only the render upload
 * (and an opted-in voice) may go out. Cloud: anything (FR-PRV-2).
 */
export function isProviderAllowed(options: {
  mode: PrivacyMode;
  provider: ProviderDeclaration;
  optIns?: PrivacyOptIns;
}): boolean {
  const { mode, provider } = options;
  if (provider.networkScope !== "external") return true;
  if (mode === "cloud") return true;
  if (mode === "local") return false;
  if (provider.role === "render-upload") return true;
  return provider.role === "voice" && options.optIns?.externalVoice === true;
}

/** Called at provider construction: an out-of-policy provider never gets built. */
export function assertProviderAllowed(options: {
  mode: PrivacyMode;
  provider: ProviderDeclaration;
  optIns?: PrivacyOptIns;
}): void {
  if (!isProviderAllowed(options)) {
    throw new PrivacyViolationError({ mode: options.mode, ...options.provider });
  }
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

export function isLoopbackHost(hostname: string): boolean {
  return loopbackHosts.has(hostname.toLowerCase()) || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

/** A provider's scope follows from where it actually connects, not from what it claims. */
export function networkScopeForUrl(url: string): NetworkScope {
  return isLoopbackHost(new URL(url).hostname) ? "localhost" : "external";
}
