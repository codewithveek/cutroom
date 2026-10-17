/** One-time setup for Local mode: downloads Kokoro's weights so runs never need the network. */
import path from "node:path";
import { loadEnv } from "@cutroom/config";
import { createKokoroProvider } from "../src/index";

const env = loadEnv();
const modelCacheDirectory = path.resolve(env.CUTROOM_DATA_DIR, "models");
const provider = createKokoroProvider({
  modelId: env.KOKORO_MODEL_ID,
  dtype: env.KOKORO_DTYPE,
  modelCacheDirectory,
  allowDownload: true,
  onProgress: (progress) => {
    if (progress.status === "progress" && progress.file) {
      process.stdout.write(`\r${progress.file} ${Math.round(progress.progress ?? 0)}%    `);
    }
  },
});
await provider.synthesizePcm({ text: "Ready.", voiceId: "af_heart", speed: 1 });
console.log(`\nKokoro ${env.KOKORO_MODEL_ID} (${env.KOKORO_DTYPE}) is cached in ${modelCacheDirectory}`);
