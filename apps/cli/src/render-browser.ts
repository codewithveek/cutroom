import { ensureRenderBrowser } from "@cutroom/renderer";

/** Downloads Remotion's headless browser on first use, before a Local-mode run blocks the network. */
export async function prepareRenderBrowser(browserExecutable: string | null): Promise<void> {
  let announced = false;
  let lastPercent = -1;
  const status = await ensureRenderBrowser({
    browserExecutable,
    onDownloadProgress: (percent) => {
      if (!announced) {
        announced = true;
        console.log("Downloading the render browser (Chrome Headless Shell) once…");
      }
      if (percent === lastPercent) return;
      lastPercent = percent;
      process.stdout.write(`\r  ${percent}%    `);
    },
  });
  if (status === "downloaded") console.log("\n✔ Render browser ready.");
}
