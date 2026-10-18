import { apiOrigin, requestHeadersFor, responseHeadersFor, upstreamUrl } from "@/features/api-proxy/upstream";

export const dynamic = "force-dynamic";

interface ProxyContext {
  params: Promise<{ path: string[] }>;
}

/** Same-origin pass-through to the API, so one-click deploys need no build-time API URL or CORS. */
async function proxy(request: Request, context: ProxyContext): Promise<Response> {
  const { path } = await context.params;
  const target = upstreamUrl({
    origin: apiOrigin(process.env.CUTROOM_API_URL),
    segments: path,
    search: new URL(request.url).search,
  });
  if (!target) {
    return Response.json({ error: { code: "not_found", message: "No such endpoint" } }, { status: 404 });
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers: requestHeadersFor(request.headers, new URL(request.url)),
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
    signal: request.signal,
    redirect: "manual",
  }).catch(() => undefined);
  if (!upstream) {
    return Response.json(
      { error: { code: "api_unreachable", message: "The Cutroom API is not reachable from the web app" } },
      { status: 502 },
    );
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeadersFor(upstream.headers),
  });
}

export { proxy as DELETE, proxy as GET, proxy as HEAD, proxy as PATCH, proxy as POST, proxy as PUT };
