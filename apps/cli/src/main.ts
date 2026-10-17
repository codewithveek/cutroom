#!/usr/bin/env -S npx tsx
import { parseArgs } from "node:util";
import { InvalidConfigError, loadEnv, productBrand } from "@cutroom/config";
import { flushTracing, initTracing } from "@cutroom/observability";
import { z } from "zod";
import { runMake } from "./commands/make";
import { runSetup } from "./commands/setup";
import { makeFlagsSchema } from "./make-options";

const usage = `${productBrand.cliName}: ${productBrand.tagline}

Usage:
  ${productBrand.cliName} make --repo <path|git-url> [--preset launch-editorial] [--ratios 16:9,9:16]
                [--privacy local|hybrid|cloud] [--look editorial] [--type launch] [--seconds 45]
                [--voice af_heart] [--music upbeat|calm|none] [--yes] [--silent] [--scripted]
  ${productBrand.cliName} setup        Download the Kokoro voice model once (needs the network)

  --yes       approve automatically when no claim is unsupported
  --silent    no voiceover (timing still follows the narration)
  --scripted  use the scripted model for the shipnote fixture (no Ollama needed)`;

async function main(argv: ReadonlyArray<string>): Promise<number> {
  const [command, ...rest] = argv;
  const env = loadEnv();
  initTracing({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  if (command === "setup") return runSetup(env);
  if (command !== "make") {
    console.log(usage);
    return command ? 1 : 0;
  }
  const { values } = parseArgs({
    args: [...rest],
    options: {
      repo: { type: "string" },
      preset: { type: "string" },
      ratios: { type: "string" },
      privacy: { type: "string" },
      look: { type: "string" },
      type: { type: "string" },
      seconds: { type: "string" },
      voice: { type: "string" },
      music: { type: "string" },
      seed: { type: "string" },
      yes: { type: "boolean", default: false },
      silent: { type: "boolean", default: false },
      scripted: { type: "boolean", default: false },
    },
  });
  return runMake(makeFlagsSchema.parse(values), env);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof InvalidConfigError) console.error(error.message);
  else if (error instanceof z.ZodError)
    console.error(`Invalid options:\n${z.prettifyError(error)}\n\n${usage}`);
  else console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await flushTracing();
}
