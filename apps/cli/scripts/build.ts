/**
 * Builds the publishable `cutroom` package:
 * 1. esbuild inlines every `@cutroom/*` workspace package into `dist/cli.js`; third-party packages
 *    stay external and become the package's dependencies.
 * 2. The Remotion bundle is built once here and shipped in `dist/remotion-bundle`, so users never
 *    need webpack or the video-kit sources.
 * 3. The shipnote fixture goes to `dist/demo-repo` for `cutroom demo`.
 * 4. The build fails if an external import is missing from `dependencies`, or pinned to a different
 *    version than the workspace uses.
 * Usage: tsx scripts/build.ts
 */
import { copyFile, cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { bundleVideoKit } from "@cutroom/renderer";
import { build, type Metafile } from "esbuild";
import { z } from "zod";

const packageDirectory = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageDirectory, "../..");
const distDirectory = path.join(packageDirectory, "dist");

/** Imported lazily and only when no prebuilt bundle exists, which never happens in the package. */
const sourceCheckoutOnlyImports = new Set(["@remotion/bundler"]);
/** Peer dependencies of remotion and @remotion/*, declared so every package manager installs them. */
const peerOnlyDependencies = new Set(["react-dom"]);

const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
});

function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

function isBuiltin(specifier: string): boolean {
  return specifier.startsWith("node:") || builtinModules.includes(packageNameOf(specifier));
}

async function bundleCli(): Promise<Metafile> {
  const result = await build({
    entryPoints: [path.join(packageDirectory, "src/main.ts")],
    outfile: path.join(distDirectory, "cli.js"),
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    metafile: true,
    legalComments: "none",
    banner: {
      // Some externals are CommonJS and call `require`; ESM output has none without this.
      js: '#!/usr/bin/env node\nimport { createRequire as cutroomCreateRequire } from "node:module";\nconst require = cutroomCreateRequire(import.meta.url);',
    },
    plugins: [
      {
        name: "externalize-third-party",
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
            args.path.startsWith("@cutroom/") ? undefined : { path: args.path, external: true },
          );
        },
      },
    ],
  });
  return result.metafile;
}

function externalPackages(metafile: Metafile): Set<string> {
  const names = new Set<string>();
  for (const output of Object.values(metafile.outputs)) {
    for (const imported of output.imports) {
      if (imported.external && !isBuiltin(imported.path)) names.add(packageNameOf(imported.path));
    }
  }
  return names;
}

async function workspaceVersions(): Promise<Map<string, string>> {
  const { globSync } = await import("node:fs");
  const versions = new Map<string, string>();
  for (const manifestPath of globSync("packages/*/package.json", { cwd: repositoryRoot })) {
    const manifest = manifestSchema.parse(
      JSON.parse(await readFile(path.join(repositoryRoot, manifestPath), "utf8")),
    );
    for (const [name, version] of Object.entries(manifest.dependencies)) versions.set(name, version);
  }
  return versions;
}

async function checkDependencies(imported: Set<string>): Promise<string[]> {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(path.join(packageDirectory, "package.json"), "utf8")),
  );
  const pinned = await workspaceVersions();
  const problems: string[] = [];
  for (const name of imported) {
    if (sourceCheckoutOnlyImports.has(name)) continue;
    const declared = manifest.dependencies[name];
    if (!declared) problems.push(`${name} is imported by dist/cli.js but missing from dependencies`);
    else if (pinned.has(name) && pinned.get(name) !== declared)
      problems.push(`${name} is ${declared} here but ${pinned.get(name)} in the workspace`);
  }
  for (const name of Object.keys(manifest.dependencies)) {
    if (!imported.has(name) && !peerOnlyDependencies.has(name))
      problems.push(`${name} is in dependencies but never imported`);
  }
  return problems;
}

await rm(distDirectory, { recursive: true, force: true });
// npm only packs a LICENSE that sits in the package directory.
await copyFile(path.join(repositoryRoot, "LICENSE"), path.join(packageDirectory, "LICENSE"));
const metafile = await bundleCli();
const problems = await checkDependencies(externalPackages(metafile));
if (problems.length > 0) {
  console.error(`Dependency check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("dist/cli.js built; dependencies match its imports");
// `cutroom demo` films the fixture the scripted model was written for. npm would drop its .gitignore anyway.
await cp(path.join(repositoryRoot, "evals/fixtures/shipnote"), path.join(distDirectory, "demo-repo"), {
  recursive: true,
  filter: (source) => path.basename(source) !== ".gitignore",
});
const remotionBundleDirectory = path.join(distDirectory, "remotion-bundle");
await bundleVideoKit({ outDir: remotionBundleDirectory });
// Remotion reads the maps to symbolicate render errors, so they stay; their embedded sources double the
// package size and their paths reveal the build machine, so those go.
const sourceMapSchema = z.looseObject({ sources: z.array(z.string()) });
for (const fileName of await readdir(remotionBundleDirectory)) {
  if (!fileName.endsWith(".map")) continue;
  const mapPath = path.join(remotionBundleDirectory, fileName);
  const { sourcesContent: _dropped, ...sourceMap } = sourceMapSchema.parse(
    JSON.parse(await readFile(mapPath, "utf8")),
  );
  const sources = sourceMap.sources.map((source) => source.split(repositoryRoot).join("cutroom"));
  await writeFile(mapPath, JSON.stringify({ ...sourceMap, sources }));
}
// The studio-only `remotion_cwd` would publish the build machine's directory layout.
const indexPath = path.join(remotionBundleDirectory, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
await writeFile(indexPath, indexHtml.replace(/window\.remotion_cwd = "[^"]*"/, 'window.remotion_cwd = "."'));
console.log("dist/remotion-bundle built");
