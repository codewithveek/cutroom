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

let server: Server;
let baseUrl = "";
const posts: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method !== "GET") posts.push(`${request.method} ${request.url}`);
    response.writeHead(200, { "content-type": "text/html" });
    response.end(page);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
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
