export const dynamic = "force-dynamic";

/** The demo asks crawlers to stay out (D-7); the app on a laptop or private host has nothing to index either. */
export function GET(): Response {
  return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
}
