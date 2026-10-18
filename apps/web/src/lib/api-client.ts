import {
  type AccountUpdate,
  type ApproveRequest,
  apiErrorEnvelopeSchema,
  apiTokenSummarySchema,
  authStatusSchema,
  type CreateApiTokenRequest,
  createdApiTokenSchema,
  type LoginRequest,
  type ProductBrief,
  type RunRequestInput,
  type RunSettingsUpdate,
  type RunView,
  runViewSchema,
  type Storyboard,
  systemStatusSchema,
  uploadResultSchema,
  voiceOptionSchema,
} from "@cutroom/scene-spec";
import { z } from "zod";

/**
 * The web app's own proxy route by default (it forwards to CUTROOM_API_URL at runtime); set
 * NEXT_PUBLIC_API_URL at build time to call the API directly instead.
 */
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "/cutroom-api";

export class ApiRequestError extends Error {
  override readonly name = "ApiRequestError";
  readonly code: string;
  readonly details: unknown;

  constructor(options: { code: string; message: string; details?: unknown }) {
    super(options.message);
    this.code = options.code;
    this.details = options.details;
  }
}

interface RequestOptions<Output> {
  path: string;
  schema: z.ZodType<Output>;
  init?: RequestInit;
}

async function request<Output>({ path, schema, init }: RequestOptions<Output>): Promise<Output> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    // FormData sets its own multipart boundary; only JSON bodies get a content type here.
    headers: {
      ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  // A deployed instance needs a login: send the browser there and keep where it was (UX only;
  // the API enforces it). The login page itself asks /auth/* and handles 401 on its own.
  if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    if (window.location.pathname !== "/login")
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  const body: unknown = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const envelope = apiErrorEnvelopeSchema.safeParse(body);
    throw new ApiRequestError(
      envelope.success
        ? envelope.data.error
        : { code: "network", message: `The API answered ${response.status}` },
    );
  }
  return schema.parse(body);
}

const lookSummarySchema = z.object({
  id: z.enum(["studio", "editorial", "graphic", "cinematic"]),
  label: z.string(),
  summary: z.string(),
  isDark: z.boolean(),
  accent: z.string(),
  ground: z.string(),
});
export type LookSummary = z.infer<typeof lookSummarySchema>;

/** Typed calls onto apps/api; every response is parsed with the shared contract. */
export const apiClient = {
  createRun: (body: RunRequestInput) =>
    request({ path: "/runs", schema: runViewSchema, init: { method: "POST", body: JSON.stringify(body) } }),
  getRun: (runId: string) => request({ path: `/runs/${runId}`, schema: runViewSchema }),
  listRuns: () => request({ path: "/runs", schema: z.object({ runs: z.array(runViewSchema) }) }),
  saveStoryboard: (runId: string, storyboard: Storyboard) =>
    request({
      path: `/runs/${runId}/storyboard`,
      schema: runViewSchema,
      init: { method: "PUT", body: JSON.stringify({ storyboard }) },
    }),
  approve: (runId: string, body: ApproveRequest) =>
    request({
      path: `/runs/${runId}/approve`,
      schema: runViewSchema,
      init: { method: "POST", body: JSON.stringify(body) },
    }),
  regenerateScene: (options: { runId: string; sceneId: string; instruction?: string | undefined }) =>
    request({
      path: `/runs/${options.runId}/scenes/${options.sceneId}/regenerate`,
      schema: runViewSchema,
      init: {
        method: "POST",
        body: JSON.stringify(options.instruction ? { instruction: options.instruction } : {}),
      },
    }),
  confirmEgress: (runId: string, manifestSha256: string) =>
    request({
      path: `/runs/${runId}/confirm-egress`,
      schema: runViewSchema,
      init: { method: "POST", body: JSON.stringify({ manifestSha256 }) },
    }),
  updateBrief: (runId: string, brief: ProductBrief) =>
    request({
      path: `/runs/${runId}/brief`,
      schema: runViewSchema,
      init: { method: "PUT", body: JSON.stringify({ brief }) },
    }),
  updateSettings: (runId: string, settings: RunSettingsUpdate) =>
    request({
      path: `/runs/${runId}/settings`,
      schema: runViewSchema,
      init: { method: "PATCH", body: JSON.stringify(settings) },
    }),
  uploadMusic: (runId: string, file: File) => {
    const form = new FormData();
    form.append("track", file);
    return request({
      path: `/runs/${runId}/music`,
      schema: runViewSchema,
      init: { method: "POST", body: form },
    });
  },
  uploadArchive: (file: File) => {
    const form = new FormData();
    form.append("archive", file);
    return request({ path: "/uploads", schema: uploadResultSchema, init: { method: "POST", body: form } });
  },
  systemStatus: () => request({ path: "/system/status", schema: systemStatusSchema }),
  listVoices: () => request({ path: "/voices", schema: z.object({ voices: z.array(voiceOptionSchema) }) }),
  voiceSampleUrl: (voiceId: string) => `${apiBaseUrl}/voices/${voiceId}/sample`,
  listLooks: () => request({ path: "/looks", schema: z.object({ looks: z.array(lookSummarySchema) }) }),
  assetUrl: (relativeUrl: string) => `${apiBaseUrl}${relativeUrl}`,
  listTags: (repoPath: string) =>
    request({
      path: `/sources/tags?path=${encodeURIComponent(repoPath)}`,
      schema: z.object({ tags: z.array(z.string()) }),
    }),
  authStatus: () => request({ path: "/auth/me", schema: authStatusSchema }),
  login: (body: LoginRequest) =>
    request({
      path: "/auth/login",
      schema: authStatusSchema,
      init: { method: "POST", body: JSON.stringify(body) },
    }),
  logout: () => request({ path: "/auth/logout", schema: z.unknown(), init: { method: "POST" } }),
  updateAccount: (body: AccountUpdate) =>
    request({
      path: "/account",
      schema: authStatusSchema,
      init: { method: "PATCH", body: JSON.stringify(body) },
    }),
  signOutOtherSessions: () =>
    request({ path: "/account/sign-out-others", schema: z.unknown(), init: { method: "POST" } }),
  listApiTokens: () =>
    request({ path: "/api-tokens", schema: z.object({ tokens: z.array(apiTokenSummarySchema) }) }),
  createApiToken: (body: CreateApiTokenRequest) =>
    request({
      path: "/api-tokens",
      schema: createdApiTokenSchema,
      init: { method: "POST", body: JSON.stringify(body) },
    }),
  revokeApiToken: (tokenId: string) =>
    request({ path: `/api-tokens/${tokenId}`, schema: z.unknown(), init: { method: "DELETE" } }),
} as const;

export type { RunView };
