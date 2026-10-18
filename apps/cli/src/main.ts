import { parseArgs } from "node:util";
import { InvalidConfigError, loadEnv, productBrand } from "@cutroom/config";
import { flushTracing, initTracing } from "@cutroom/observability";
import { z } from "zod";
import { runMake } from "./commands/make";
import { runSetup } from "./commands/setup";
import { type MakeFlags, makeFlagsSchema } from "./make-options";
import { findDemoRepository } from "./package-assets";

const usage = `${productBrand.cliName}: ${productBrand.tagline}

Usage:
  ${productBrand.cliName} make --repo <path|git-url|app.zip> [--preset launch-editorial] [--ratios 16:9,9:16]
                [--privacy local|hybrid|cloud] [--look editorial] [--type launch] [--seconds 45]
                [--voice af_heart] [--music upbeat|calm|none] [--yes] [--silent] [--scripted]
                [--app-url http://localhost:3000 --routes /,/settings] [--watermark]
                [--direction "for developers, focus on the CLI"]
  ${productBrand.cliName} demo [--ratios 16:9,9:16] [--voice af_heart]
               Film the bundled demo repo with a scripted model: no Ollama or GPU needed
               (silent unless --voice is given, which needs \`setup\` first)
  ${productBrand.cliName} setup        Download the Kokoro voice model once (needs the network)

  --yes       approve automatically when no claim is unsupported
  --silent    no voiceover (timing still follows the narration)
  --scripted  use the scripted model for the shipnote fixture (no Ollama needed)
  --app-url   capture screens of the running app (read-only) for window scenes
  --routes    comma-separated routes to capture on --app-url (default /)
  --watermark a "created with cutroom" badge in the bottom-right corner
  --direction a free-text steer for the storyboard (redacted before the model sees it)`;

const entryDirectory = import.meta.dirname;

function parseMakeFlags(args: ReadonlyArray<string>): MakeFlags {
  const { values } = parseArgs({
    args: [...args],
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
      "app-url": { type: "string" },
      routes: { type: "string" },
      yes: { type: "boolean", default: false },
      silent: { type: "boolean", default: false },
      scripted: { type: "boolean", default: false },
      watermark: { type: "boolean", default: false },
      direction: { type: "string" },
    },
  });
  return makeFlagsSchema.parse({ ...values, appUrl: values["app-url"] });
}

/** `cutroom demo`: the shipnote fixture, the scripted model, approved automatically. */
function demoFlags(args: ReadonlyArray<string>): MakeFlags {
  const repo = findDemoRepository(entryDirectory);
  if (!repo) throw new Error("The demo repository is missing from this installation.");
  const { values } = parseArgs({
    args: [...args],
    options: { ratios: { type: "string" }, voice: { type: "string" } },
  });
  return makeFlagsSchema.parse({ ...values, repo, scripted: true, yes: true, silent: !values.voice });
}

async function main(argv: ReadonlyArray<string>): Promise<number> {
  const [command, ...rest] = argv;
  const env = loadEnv();
  initTracing({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  if (command === "setup") return runSetup(env);
  if (command === "make") return runMake({ flags: parseMakeFlags(rest), env, entryDirectory });
  if (command === "demo") return runMake({ flags: demoFlags(rest), env, entryDirectory });
  console.log(usage);
  return command ? 1 : 0;
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
// A failed render can leave Remotion's browser holding the event loop open; the command is over either way.
process.exit(process.exitCode);
