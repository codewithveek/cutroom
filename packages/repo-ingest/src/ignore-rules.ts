import ignore, { type Ignore } from "ignore";

/** Never worth reading: dependencies, build output, vendored code, lockfiles (FR-ING-2). */
export const defaultIgnorePatterns: ReadonlyArray<string> = [
  ".git/",
  "node_modules/",
  "bower_components/",
  "vendor/",
  "third_party/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  ".turbo/",
  ".cache/",
  "coverage/",
  "target/",
  "__pycache__/",
  ".venv/",
  "venv/",
  ".cutroom/",
  "*.min.js",
  "*.min.css",
  "*.map",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
];

const binaryExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "tiff",
  "avif",
  "psd",
  "mp4",
  "mov",
  "webm",
  "mp3",
  "wav",
  "ogg",
  "flac",
  "m4a",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "zip",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "tar",
  "pdf",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "class",
  "jar",
  "wasm",
  "o",
  "a",
  "pyc",
  "sqlite",
  "db",
  "onnx",
  "pt",
  "safetensors",
]);

export function hasBinaryExtension(relativePath: string): boolean {
  const extension = relativePath.split(".").pop()?.toLowerCase() ?? "";
  return binaryExtensions.has(extension);
}

/** A NUL byte in the first 8 KB means binary, whatever the extension says. */
export function looksBinary(content: Buffer): boolean {
  return content.subarray(0, 8192).includes(0);
}

export function createIgnoreMatcher(gitignoreContents: ReadonlyArray<string>): Ignore {
  return ignore()
    .add([...defaultIgnorePatterns])
    .add(gitignoreContents.join("\n"));
}
