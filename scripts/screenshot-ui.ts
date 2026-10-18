/**
 * Drives the web app through a whole run with Playwright, checks each interaction did what it
 * should, and saves a screenshot per screen in both themes.
 * Needs the API (MODEL_PROVIDER=scripted-shipnote works without a model) and the web app running.
 * Usage: tsx scripts/screenshot-ui.ts [outDir]
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type Browser, chromium, type Page } from "playwright";

const [outDirectory = "docs/screenshots"] = process.argv.slice(2);
const webUrl = "http://localhost:3000";
const viewport = { width: 1600, height: 1000 };

type Theme = "dark" | "light";

/** Polls until `check` holds, or fails the script with `message`. */
async function until(check: () => Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`UI check failed: ${message}`);
}

async function openPage(options: { browser: Browser; theme: Theme }): Promise<Page> {
  const context = await options.browser.newContext({ viewport });
  await context.addInitScript((theme) => localStorage.setItem("cutroom-theme", theme), options.theme);
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("pageerror:", error.message));
  return page;
}

/** Scrolling pages scroll inside <main>; let the document grow so a full-page capture gets it all. */
async function capture(options: { page: Page; name: string; fullPage?: boolean }): Promise<void> {
  if (options.fullPage) {
    await options.page.addStyleTag({
      content:
        ".h-dvh{height:auto!important;min-height:100dvh} main{overflow:visible!important} aside{position:sticky;top:12px;height:calc(100dvh - 24px)!important}",
    });
  }
  const filePath = path.join(outDirectory, `${options.name}.png`);
  await options.page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
  console.log(`saved ${filePath}`);
}

async function editorTab(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name }).click();
  await page.waitForTimeout(1200);
}

await mkdir(outDirectory, { recursive: true });
const browser = await chromium.launch({
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: local QA script
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

// Dashboard, both themes.
for (const theme of ["dark", "light"] as const) {
  const page = await openPage({ browser, theme });
  await page.goto(webUrl);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForTimeout(3000);
  await capture({ page, name: `01-dashboard-${theme}`, fullPage: true });
  await page.close();
}

// Start a run from the composer with the sample repository and a direction.
const page = await openPage({ browser, theme: "dark" });
await page.goto(webUrl);
await page.getByRole("button", { name: /Try the sample repository/ }).click();
await until(
  async () => (await page.locator("#repo").inputValue()).endsWith("shipnote"),
  "sample repo filled in",
);
await page.locator("#direction").fill("For developers who ship weekly; focus on the CLI.");
await page.getByRole("button", { name: "Make the video" }).click();
await page.waitForURL(/\/runs\//, { timeout: 20_000 });

// The editor opens when the storyboard is audited.
await page.getByRole("button", { name: "Approve & render" }).waitFor({ timeout: 180_000 });
await page.waitForTimeout(3000);
await capture({ page, name: "03-editor-script" });

// Edit on-screen text: the draft is dirty, then undo restores it.
await editorTab(page, "Text");
const textPanel = page
  .locator("section")
  .filter({ has: page.getByRole("heading", { name: "Text", exact: true }) });
const firstLine = textPanel.getByRole("textbox").nth(1);
await firstLine.fill("Release notes eat *your whole* afternoon");
await page.getByRole("button", { name: "Save & re-audit" }).waitFor();
await capture({ page, name: "04-editor-text-edited" });
await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
await page.getByRole("button", { name: "Approve & render" }).waitFor();

// Add a scene, then undo it.
await editorTab(page, "Script");
const sceneCount = await page.locator("ol[aria-label=Scenes] > li").count();
await page.getByRole("button", { name: "Add a scene" }).click();
await page.getByRole("menuitem", { name: "Big number" }).click();
await until(
  async () => (await page.locator("ol[aria-label=Scenes] > li").count()) === sceneCount + 1,
  "scene added",
);
await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
await until(
  async () => (await page.locator("ol[aria-label=Scenes] > li").count()) === sceneCount,
  "scene undone",
);

// Save a real edit (a transition, so no claim changes): the server versions and re-audits it.
await editorTab(page, "Transitions");
await page.getByRole("combobox", { name: "Transition into scene 2" }).selectOption("zoom");
await page.getByRole("button", { name: "Save & re-audit" }).click();
await page.getByRole("button", { name: "Approve & render" }).waitFor({ timeout: 30_000 });
await until(async () => (await page.getByText(/· v2/).count()) > 0, "storyboard saved as v2");
await editorTab(page, "Script");

// Pick another voice: the run's settings change on the server.
await page.getByRole("button", { name: /^Bella/ }).click();
await until(
  async () => (await page.getByRole("button", { name: /^Bella/ }).getAttribute("aria-pressed")) === "true",
  "voice changed to Bella",
);

// Every left-panel mode, and a vertical preview.
for (const [tab, name] of [
  ["Audio", "05-editor-audio"],
  ["Captions", "06-editor-captions"],
  ["Transitions", "07-editor-transitions"],
  ["Media", "08-editor-media"],
] as const) {
  await editorTab(page, tab);
  await capture({ page, name });
}
await editorTab(page, "Script");
await page.getByRole("button", { name: "9:16", exact: true }).click();
await page.waitForTimeout(2000);
await capture({ page, name: "09-editor-vertical" });
await page.getByRole("button", { name: "16:9", exact: true }).click();

// Collapsed rail: the projects tree flies out on hover.
await page.getByRole("button", { name: "Projects" }).hover();
await page.waitForTimeout(600);
await capture({ page, name: "10-sidebar-flyout" });

// Approve, render, and land on the final renders.
await page.getByRole("button", { name: "Approve & render" }).click();
await page.getByRole("button", { name: "Rendering…" }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(6000);
await capture({ page, name: "11-editor-rendering" });
await page.getByRole("button", { name: "Final renders" }).waitFor({ timeout: 900_000 });
await page.locator("video").first().waitFor({ timeout: 600_000 });
await page.getByRole("heading", { name: "Delivery note" }).waitFor({ timeout: 600_000 });
await page.waitForTimeout(4000);
await capture({ page, name: "12-editor-renders" });
await page.getByRole("button", { name: "Live preview" }).click();
await page.waitForTimeout(4000);
await capture({ page, name: "13-editor-voiced-timeline" });
const runUrl = page.url();
await page.close();

// The editor in light mode, then the other pages.
const lightEditor = await openPage({ browser, theme: "light" });
await lightEditor.goto(runUrl);
await lightEditor.getByRole("button", { name: "Live preview" }).click({ timeout: 60_000 });
await lightEditor.waitForTimeout(4000);
await capture({ page: lightEditor, name: "14-editor-light" });
await lightEditor.close();

for (const [route, name] of [
  ["/library", "15-library"],
  ["/activity", "16-activity"],
  ["/styles", "17-styles"],
  ["/settings", "18-settings"],
  ["/new", "19-advanced-setup"],
] as const) {
  const other = await openPage({ browser, theme: "dark" });
  await other.goto(`${webUrl}${route}`);
  await other.getByRole("heading", { level: 1 }).first().waitFor();
  await other.waitForTimeout(3000);
  await capture({ page: other, name, fullPage: true });
  await other.close();
}

await browser.close();
