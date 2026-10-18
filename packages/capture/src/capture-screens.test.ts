import { mkdtemp, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CaptureError, captureScreens } from "./capture-screens";

const page = `<!doctype html><html><head><title>Shipnote</title></head><body style="font-family:sans-serif;padding:40px">
<h1>Release notes</h1>
<p>Token: ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD</p>
<button>Export PDF</button>
<img src="https://example.com/tracker.png" alt="">
<script>fetch("/api/delete", { method: "POST" }).catch(() => {});</script>
</body></html>`;

/** Like the run editor: an open server-sent-events stream keeps the network busy forever. */
const streamingPage = `<!doctype html><html><head><title>Live run</title></head><body>
<h1>Rendering</h1><script>new EventSource("/events");</script></body></html>`;

let server: Server;
let baseUrl = "";
const posts: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method !== "GET") posts.push(`${request.method} ${request.url}`);
    if (request.url === "/events") {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write("data: started\n\n");
      return;
    }
    if (request.url === "/missing") {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("<h1>Not found</h1>");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(request.url === "/live" ? streamingPage : page);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe("captureScreens", () => {
  it("captures read-only, redacts secrets and finds real element boxes", async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-capture-"));
    const manifest = await captureScreens({
      request: { appUrl: baseUrl, routes: ["/", "/settings"] },
      outputDirectory,
      uiStrings: ["Export PDF", "Release notes", "Not on the page"],
      privacyMode: "local",
    });
    expect(manifest.screens.map((screen) => screen.id)).toEqual(["screen-1", "screen-2"]);
    const [first] = manifest.screens;
    expect(first?.title).toBe("Shipnote");
    expect(first?.targets.map((target) => target.text).toSorted()).toEqual(["Export PDF", "Release notes"]);
    expect(first?.targets.every((target) => target.box.width > 0 && target.box.height > 0)).toBe(true);
    expect(first?.redactions).toBeGreaterThanOrEqual(1);
    expect((await stat(path.join(outputDirectory, first?.fileName ?? ""))).size).toBeGreaterThan(1000);
    // The page's POST and the external image were both refused; the server never saw the POST.
    expect(manifest.blockedRequests).toBeGreaterThanOrEqual(2);
    expect(posts).toEqual([]);
  }, 60_000);

  it("captures a page that keeps a stream open", async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-capture-"));
    const startedAt = Date.now();
    const manifest = await captureScreens({
      request: { appUrl: baseUrl, routes: ["/live"] },
      outputDirectory,
      uiStrings: ["Rendering"],
      privacyMode: "local",
    });
    expect(manifest.screens[0]?.title).toBe("Live run");
    expect(Date.now() - startedAt).toBeLessThan(20_000);
  }, 60_000);

  it("names the status of a route that does not exist", async () => {
    await expect(
      captureScreens({
        request: { appUrl: baseUrl, routes: ["/missing"] },
        outputDirectory: tmpdir(),
        uiStrings: [],
        privacyMode: "local",
      }),
    ).rejects.toThrow(/answered 404/);
  }, 60_000);

  it("refuses a remote app in Local mode", async () => {
    await expect(
      captureScreens({
        request: { appUrl: "https://example.com", routes: ["/"] },
        outputDirectory: tmpdir(),
        uiStrings: [],
        privacyMode: "local",
      }),
    ).rejects.toThrow(CaptureError);
  });
});
