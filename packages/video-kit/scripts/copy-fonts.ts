import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fontManifest } from "../src/fonts/font-manifest";

const require = createRequire(import.meta.url);
const targetDirectory = path.join(import.meta.dirname, "..", "public", "fonts");

await mkdir(targetDirectory, { recursive: true });
for (const font of fontManifest) {
  const packageDirectory = path.dirname(require.resolve(`@fontsource/${font.packageName}/package.json`));
  await copyFile(
    path.join(packageDirectory, "files", font.fileName),
    path.join(targetDirectory, font.fileName),
  );
  console.log(`copied ${font.fileName}`);
}
for (const font of new Set(fontManifest.map((entry) => entry.packageName))) {
  const packageDirectory = path.dirname(require.resolve(`@fontsource/${font}/package.json`));
  await copyFile(path.join(packageDirectory, "LICENSE"), path.join(targetDirectory, `${font}-LICENSE.txt`));
}
