import { DEMO_READ_ONLY_MESSAGE } from "@cutroom/scene-spec";

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The demo's web app refuses writes on every path too (prd-site D-3), so `curl -X POST
 * https://demo.cutroom.tech/projects` gets the same answer as the API behind it.
 */
export function proxy(request: Request): Response | undefined {
  if (process.env.CUTROOM_DEMO_MODE !== "true" || readMethods.has(request.method)) return undefined;
  return Response.json(
    { error: { code: "DEMO_READ_ONLY", message: DEMO_READ_ONLY_MESSAGE } },
    { status: 403 },
  );
}

export const config = { matcher: "/:path*" };
