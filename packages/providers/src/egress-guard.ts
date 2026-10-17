import http from "node:http";
import https from "node:https";
import { isLoopbackHost } from "./privacy-guard";

export class EgressBlockedError extends Error {
  override readonly name = "EgressBlockedError";
}

function hostOf(target: unknown): string | undefined {
  if (typeof target === "string") {
    try {
      return new URL(target).hostname;
    } catch {
      return undefined;
    }
  }
  if (target instanceof URL) return target.hostname;
  if (target && typeof target === "object" && "url" in target && typeof target.url === "string") {
    return hostOf(target.url);
  }
  if (target && typeof target === "object") {
    const options = target as { hostname?: unknown; host?: unknown };
    const host = options.hostname ?? options.host;
    return typeof host === "string" ? host.replace(/:\d+$/, "") : undefined;
  }
  return undefined;
}

function assertLoopback(target: unknown): void {
  const host = hostOf(target);
  if (host !== undefined && !isLoopbackHost(host)) {
    throw new EgressBlockedError(`Local mode blocked an outbound connection to ${host}`);
  }
}

export interface EgressGuard {
  release(): void;
}

/**
 * Defence in depth for Local mode (P4): patches fetch and http(s).request so any
 * non-loopback connection throws before a byte is sent.
 */
export function installLocalEgressGuard(): EgressGuard {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalHttpGet = http.get;
  const originalHttpsGet = https.get;
  globalThis.fetch = async (input, init) => {
    assertLoopback(input);
    return originalFetch(input, init);
  };
  const guardRequest = <Request extends (...args: never[]) => unknown>(original: Request): Request =>
    ((...args: Parameters<Request>) => {
      assertLoopback(args[0]);
      return original(...args);
    }) as Request;
  http.request = guardRequest(originalHttpRequest);
  https.request = guardRequest(originalHttpsRequest);
  http.get = guardRequest(originalHttpGet);
  https.get = guardRequest(originalHttpsGet);
  return {
    release() {
      globalThis.fetch = originalFetch;
      http.request = originalHttpRequest;
      https.request = originalHttpsRequest;
      http.get = originalHttpGet;
      https.get = originalHttpsGet;
    },
  };
}
