/**
 * Drives the web app with Playwright and saves screenshots (local QA of the UI).
 * Usage: tsx scripts/screenshot-ui.ts <outDir> <repoPath>
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const [outDirectory = ".cutroom/screenshots", repoPath = "evals/fixtures/shipnote"] = process.argv.slice(2);
await mkdir(outDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("console", (message) => {
  if (message.type() === "error") console.error("browser:", message.text());
});
await page.goto("http://localhost:3000/");
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDirectory, "01-new-video.png"), fullPage: true });
await page.fill("#repo", path.resolve(repoPath));
await page.click("button[type=submit]");
await page.waitForURL(/\/runs\//, { timeout: 20_000 });
await page.waitForSelector("text=Ready for your review", { timeout: 120_000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDirectory, "02-storyboard.png"), fullPage: true });
await page.click("ol[aria-label=Scenes] li:nth-child(4) button");
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDirectory, "03-scene-selected.png"), fullPage: false });
console.log(page.url());
await browser.close();
