/** Where the web server finds the API, read at request time (deploys set it after the image is built). */
export function apiOrigin(configured: string | undefined): string {
  const value = configured?.trim() || "http://localhost:4100";
  // Render's fromService hostport and DigitalOcean's private domain come without a scheme.
  const withScheme = /^https?:\/\//.test(value) ? value : `http://${value}`;
  return withScheme.replace(/\/+$/, "");
}

/** The API URL for a proxied path, or undefined when a segment would step outside the API. */
export function upstreamUrl(options: {
  origin: string;
  segments: ReadonlyArray<string>;
  search: string;
}): string | undefined {
  if (options.segments.some((segment) => segment === ".." || segment === "." || segment.includes("/")))
    return undefined;
  const path = options.segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${options.origin}/${path}${options.search}`;
}

/** The session cookie, bearer tokens and Origin carry the API's auth and CSRF checks (E7). */
const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "range",
  "last-event-id",
  "if-none-match",
  "cookie",
  "authorization",
  "origin",
  "user-agent",
  "x-forwarded-for",
];
/** Hop-by-hop headers, plus encoding and length that fetch has already undone. */
const droppedResponseHeaders = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
]);

/** `requestUrl` is the browser's URL of this web app: the API checks Origin against its host. */
export function requestHeadersFor(incoming: Headers, requestUrl: URL): Headers {
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "x-forwarded-host",
    incoming.get("x-forwarded-host") ?? incoming.get("host") ?? requestUrl.host,
  );
  headers.set(
    "x-forwarded-proto",
    incoming.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? requestUrl.protocol.replace(":", ""),
  );
  return headers;
}

export function responseHeadersFor(upstream: Headers): Headers {
  const headers = new Headers();
  upstream.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (!droppedResponseHeaders.has(lower) && lower !== "set-cookie") headers.set(name, value);
  });
  // Each cookie stays its own header; forEach would join them with commas.
  for (const cookie of upstream.getSetCookie()) headers.append("set-cookie", cookie);
  // Server-sent run events must reach the browser as they happen.
  if (upstream.get("content-type")?.startsWith("text/event-stream")) headers.set("x-accel-buffering", "no");
  return headers;
}
