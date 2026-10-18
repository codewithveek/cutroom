import { mkdir } from "node:fs/promises";
import path from "node:path";
import { isLoopbackHost } from "@cutroom/providers";
import { resolveBrowserExecutable } from "@cutroom/renderer";
import { redactSecrets } from "@cutroom/repo-ingest";
import {
  type CapturedScreen,
  type CaptureManifest,
  type CaptureRequest,
  captureManifestSchema,
  type PrivacyMode,
  type ScreenTarget,
} from "@cutroom/scene-spec";
import { ensureBrowser } from "@remotion/renderer";
import { type Browser, chromium, type Page } from "playwright-core";

export class CaptureError extends Error {
  override readonly name = "CaptureError";
}

/** FR-CAP-1: a laptop-sized viewport, captured at 2× so it stays sharp under camera zoom. */
export const CAPTURE_VIEWPORT = { width: 1440, height: 900 } as const;
export const CAPTURE_SCALE = 2;
const NAVIGATION_TIMEOUT_MS = 20_000;
const MAX_TARGETS_PER_SCREEN = 40;
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CaptureScreensOptions {
  request: CaptureRequest;
  outputDirectory: string;
  /** Texts from the repo's UI string inventory; matching visible elements become camera targets. */
  uiStrings: ReadonlyArray<string>;
  privacyMode: PrivacyMode;
  browserExecutable?: string | null | undefined;
}

async function launchBrowser(configured: string | null | undefined): Promise<Browser> {
  let executablePath = resolveBrowserExecutable(configured ?? undefined) ?? undefined;
  if (!executablePath) {
    // The same Chrome Headless Shell Remotion renders with; downloaded once if missing.
    const status = await ensureBrowser();
    if (status.type === "user-defined-path" || status.type === "local-puppeteer-browser")
      executablePath = status.path;
  }
  if (!executablePath) throw new CaptureError("No Chromium to capture with; set BROWSER_EXECUTABLE.");
  return chromium.launch({ executablePath, headless: true });
}

/**
 * FR-CAP-2: read-only. Anything but GET/HEAD/OPTIONS is aborted, so clicks or scripts cannot
 * submit, save or delete. In Local mode only loopback hosts are reachable at all.
 */
async function guardRequests(options: {
  page: Page;
  privacyMode: PrivacyMode;
  onBlocked: () => void;
}): Promise<void> {
  await options.page.route("**/*", async (route) => {
    const request = route.request();
    const host = (() => {
      try {
        return new URL(request.url()).hostname;
      } catch {
        return "";
      }
    })();
    const leavesMachine =
      options.privacyMode === "local" && !request.url().startsWith("data:") && !isLoopbackHost(host);
    if (!safeMethods.has(request.method()) || leavesMachine) {
      options.onBlocked();
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

/** Replaces secret-looking text on the page before the screenshot, so no frame can show one. */
async function redactPageText(page: Page): Promise<number> {
  const texts = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const values: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) values.push(node.textContent ?? "");
    const inputs = [...document.querySelectorAll("input, textarea")].map(
      (element) => (element as HTMLInputElement).value,
    );
    return { values, inputs };
  });
  const redactAll = (values: ReadonlyArray<string>) => values.map((value) => redactSecrets(value));
  const textResults = redactAll(texts.values);
  const inputResults = redactAll(texts.inputs);
  const redactions = [...textResults, ...inputResults].reduce(
    (sum, result) => sum + result.redactions.length,
    0,
  );
  if (redactions === 0) return 0;
  await page.evaluate(
    (replacements) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let index = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const next = replacements.text[index];
        if (next !== undefined && next !== node.textContent) node.textContent = next;
        index += 1;
      }
      [...document.querySelectorAll("input, textarea")].forEach((element, inputIndex) => {
        const next = replacements.inputs[inputIndex];
        if (next !== undefined) (element as HTMLInputElement).value = next;
      });
    },
    {
      text: textResults.map((result) => result.content),
      inputs: inputResults.map((result) => result.content),
    },
  );
  return redactions;
}

/** FR-CAP-3: boxes of visible elements whose text is a known UI string, so the camera aims at real things. */
async function findTargets(page: Page, uiStrings: ReadonlyArray<string>): Promise<ScreenTarget[]> {
  const targets: ScreenTarget[] = [];
  const unique = [
    ...new Set(uiStrings.map((text) => text.trim()).filter((text) => text.length > 1 && text.length <= 60)),
  ];
  for (const text of unique) {
    if (targets.length >= MAX_TARGETS_PER_SCREEN) break;
    const locator = page.getByText(text, { exact: true }).first();
    const box = await locator.boundingBox({ timeout: 300 }).catch(() => null);
    if (!box || box.width <= 0 || box.height <= 0) continue;
    if (box.y + box.height > CAPTURE_VIEWPORT.height || box.x + box.width > CAPTURE_VIEWPORT.width) continue;
    targets.push({
      text,
      box: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height },
    });
  }
  return targets;
}

/** Captures each route of a running app: screenshot, page title and camera targets (PRD §7.14). */
export async function captureScreens(options: CaptureScreensOptions): Promise<CaptureManifest> {
  const appUrl = new URL(options.request.appUrl);
  if (options.privacyMode === "local" && !isLoopbackHost(appUrl.hostname))
    throw new CaptureError(`Local mode only captures apps on this machine; ${appUrl.host} is not.`);
  await mkdir(options.outputDirectory, { recursive: true });
  const browser = await launchBrowser(options.browserExecutable);
  let blockedRequests = 0;
  const screens: CapturedScreen[] = [];
  try {
    const context = await browser.newContext({
      viewport: CAPTURE_VIEWPORT,
      deviceScaleFactor: CAPTURE_SCALE,
    });
    for (const [index, route] of options.request.routes.entries()) {
      const page = await context.newPage();
      await guardRequests({
        page,
        privacyMode: options.privacyMode,
        onBlocked: () => (blockedRequests += 1),
      });
      const url = new URL(route, appUrl).toString();
      const response = await page
        .goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS })
        .catch(() => null);
      if (!response) throw new CaptureError(`Could not open ${url}; is the app running?`);
      const redactions = await redactPageText(page);
      const id = `screen-${index + 1}`;
      const fileName = `${id}.png`;
      await page.screenshot({ path: path.join(options.outputDirectory, fileName) });
      screens.push({
        id,
        route,
        title: (await page.title()).slice(0, 120),
        width: CAPTURE_VIEWPORT.width,
        height: CAPTURE_VIEWPORT.height,
        fileName,
        targets: await findTargets(page, options.uiStrings),
        redactions,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return captureManifestSchema.parse({
    appUrl: appUrl.toString(),
    capturedAt: new Date().toISOString(),
    screens,
    blockedRequests,
  });
}
