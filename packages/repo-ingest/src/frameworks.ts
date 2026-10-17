import { z } from "zod";

const packageManifestSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    homepage: z.string().optional(),
    scripts: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    bin: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  })
  .loose();
export type PackageManifest = z.infer<typeof packageManifestSchema>;

export function parsePackageManifest(content: string): PackageManifest | undefined {
  try {
    const result = packageManifestSchema.safeParse(JSON.parse(content));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

const frameworkByDependency: ReadonlyArray<[string, string]> = [
  ["next", "next"],
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["@sveltejs/kit", "sveltekit"],
  ["astro", "astro"],
  ["solid-js", "solid"],
  ["@angular/core", "angular"],
  ["express", "express"],
  ["fastify", "fastify"],
  ["hono", "hono"],
  ["@nestjs/core", "nestjs"],
  ["electron", "electron"],
  ["react-native", "react-native"],
  ["commander", "cli"],
  ["yargs", "cli"],
  ["remotion", "remotion"],
  ["tailwindcss", "tailwind"],
];

const frameworkByPythonPackage: ReadonlyArray<[RegExp, string]> = [
  [/\bdjango\b/i, "django"],
  [/\bflask\b/i, "flask"],
  [/\bfastapi\b/i, "fastapi"],
  [/\b(click|typer)\b/i, "cli"],
];

export function detectNodeFrameworks(manifest: PackageManifest): string[] {
  const dependencyNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const frameworks = frameworkByDependency
    .filter(([dependency]) => dependencyNames.has(dependency))
    .map(([, framework]) => framework);
  if (manifest.bin) frameworks.push("cli");
  return frameworks;
}

export function detectPythonFrameworks(pyprojectOrRequirements: string): string[] {
  return frameworkByPythonPackage
    .filter(([pattern]) => pattern.test(pyprojectOrRequirements))
    .map(([, name]) => name);
}

export const webUiFrameworks = new Set([
  "next",
  "react",
  "vue",
  "svelte",
  "sveltekit",
  "astro",
  "solid",
  "angular",
  "electron",
  "react-native",
  "django",
  "flask",
]);
