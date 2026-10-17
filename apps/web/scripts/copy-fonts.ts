/** The Remotion player in the browser loads the same self-hosted fonts as renders do. */
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(import.meta.dirname, "../../../packages/video-kit/public/fonts");
const target = path.resolve(import.meta.dirname, "../public/fonts");
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log(`fonts copied to ${target}`);
