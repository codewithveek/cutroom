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

async function request<Output>(path: string, schema: z.ZodType<Output>, init?: RequestInit): Promise<Output> {
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
    request("/runs", runViewSchema, { method: "POST", body: JSON.stringify(body) }),
  getRun: (runId: string) => request(`/runs/${runId}`, runViewSchema),
  listRuns: () => request("/runs", z.object({ runs: z.array(runViewSchema) })),
  saveStoryboard: (runId: string, storyboard: Storyboard) =>
    request(`/runs/${runId}/storyboard`, runViewSchema, {
      method: "PUT",
      body: JSON.stringify({ storyboard }),
    }),
  approve: (runId: string, body: ApproveRequest) =>
    request(`/runs/${runId}/approve`, runViewSchema, { method: "POST", body: JSON.stringify(body) }),
  listLooks: () => request("/looks", z.object({ looks: z.array(lookSummarySchema) })),
  assetUrl: (relativeUrl: string) => `${apiBaseUrl}${relativeUrl}`,
} as const;

export type { RunView };
