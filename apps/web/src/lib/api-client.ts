import {
  type ApproveRequest,
  apiErrorEnvelopeSchema,
  type RunRequestInput,
  type RunView,
  runViewSchema,
  type Storyboard,
} from "@cutroom/scene-spec";
import { z } from "zod";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

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
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => ({}));
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
  listLooks: () => request({ path: "/looks", schema: z.object({ looks: z.array(lookSummarySchema) }) }),
  assetUrl: (relativeUrl: string) => `${apiBaseUrl}${relativeUrl}`,
} as const;

export type { RunView };
