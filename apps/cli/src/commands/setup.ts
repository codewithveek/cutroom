import path from "node:path";
import { type CutroomEnv, productBrand } from "@cutroom/config";
import { resolveBrowserExecutable } from "@cutroom/renderer";
import { createKokoroProvider } from "@cutroom/voice";
import { prepareRenderBrowser } from "../render-browser";

/** One-time, online: downloads Kokoro and the render browser so Local-mode runs never touch the network. */
export async function runSetup(env: CutroomEnv): Promise<number> {
  const modelCacheDirectory = path.resolve(env.CUTROOM_DATA_DIR, "models");
  console.log(`Downloading ${env.KOKORO_MODEL_ID} (${env.KOKORO_DTYPE}) to ${modelCacheDirectory}…`);
  const provider = createKokoroProvider({
    modelId: env.KOKORO_MODEL_ID,
    dtype: env.KOKORO_DTYPE,
    modelCacheDirectory,
    allowDownload: true,
    onProgress: (progress) => {
      if (progress.status === "progress" && progress.file) {
        process.stdout.write(`\r  ${progress.file} ${Math.round(progress.progress ?? 0)}%    `);
      }
    },
  });
  await provider.synthesizePcm({ text: "Ready.", voiceId: "af_heart", speed: 1 });
  await prepareRenderBrowser(resolveBrowserExecutable(env.BROWSER_EXECUTABLE));
  console.log(
    `\n✔ Voice model ready. Next: \`ollama pull ${env.MODEL_ID}\`, then \`${productBrand.cliName} make --repo .\``,
  );
  return 0;
}
