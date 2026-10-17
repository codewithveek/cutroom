/**
 * Drives the web app through a whole run with Playwright and saves a screenshot per screen.
 * Needs the API (MODEL_PROVIDER=scripted-shipnote works without a model) and the web app running.
 * Usage: tsx scripts/screenshot-ui.ts [outDir] [repoPath]
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [outDirectory = "docs/screenshots", repoPath = "evals/fixtures/shipnote"] = process.argv.slice(2);
const webUrl = "http://localhost:3000";

async function capture(page: Page, name: string, fullPage = true): Promise<void> {
  // Full-page captures stitch the viewport; a sticky header would be pinned mid-image.
  if (fullPage) await page.addStyleTag({ content: "header { position: static !important; }" });
  const filePath = path.join(outDirectory, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`saved ${filePath}`);
}

await mkdir(outDirectory, { recursive: true });
const browser = await chromium.launch({
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: local QA script
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("console", (message) => {
  if (message.type() === "error") console.error("browser:", message.text());
});

await page.goto(webUrl);
await page.waitForTimeout(3000);
await capture(page, "01-new-video");

await page.fill("#repo", path.resolve(repoPath));
await page.getByRole("button", { name: "9:16", exact: true }).click();
await page.click("button[type=submit]");
await page.waitForURL(/\/runs\//, { timeout: 20_000 });
await page.waitForSelector("text=Ready for your review", { timeout: 180_000 });
await page.waitForTimeout(3000);
await capture(page, "02-storyboard-review");

await page.click("ol[aria-label=Scenes] li:nth-child(4) button");
await page.waitForTimeout(2000);
await capture(page, "03-scene-inspector", false);

await page.getByText("9:16", { exact: true }).first().click();
await page.waitForTimeout(2000);
await capture(page, "04-vertical-preview", false);

await page
  .getByRole("button", { name: /src\/group-commits\.ts:1/ })
  .first()
  .click();
await page.waitForTimeout(800);
await capture(page, "05-evidence-viewer", false);
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "Approve and render" }).click();
await page.waitForSelector("text=Rendering", { timeout: 300_000 });
await page.waitForTimeout(8000);
await capture(page, "06-rendering");

await page.waitForSelector("video", { timeout: 900_000 });
await page.waitForSelector('h3:has-text("Delivery note")', { timeout: 600_000 });
await page.waitForSelector('img[alt*="scene"]', { timeout: 600_000 });
await page.waitForTimeout(4000);
await capture(page, "07-renders-and-quality");

await page.goto(`${webUrl}/library`);
await page.waitForTimeout(3000);
await capture(page, "08-library");

await browser.close();
