import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWebVtt, formatVttTimestamp } from "./captions-vtt";
import { parseLoudnormReport } from "./loudness";
import { nextVersionedPath } from "./versioned-path";

describe("captions", () => {
  it("formats WebVTT timestamps and cues", () => {
    expect(formatVttTimestamp(3_723_456)).toBe("01:02:03.456");
    const vtt = buildWebVtt([{ startFrame: 30, endFrame: 75, text: "Hello there.\nSecond line" }], 30);
    expect(vtt).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHello there.\nSecond line\n");
  });
});

describe("parseLoudnormReport", () => {
  it("reads the JSON block at the end of ffmpeg's output", () => {
    const stderr = `[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-23.10",\n\t"input_tp" : "-4.20",\n\t"input_lra" : "5.00",\n\t"input_thresh" : "-33.50",\n\t"output_i" : "-16.0",\n\t"target_offset" : "0.10"\n}\n`;
    expect(parseLoudnormReport(stderr).input_i).toBe("-23.10");
  });
});

describe("nextVersionedPath", () => {
  it("never overwrites an existing render", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "cutroom-versions-"));
    const first = await nextVersionedPath({ directory, baseName: "launch-16x9", extension: ".mp4" });
    expect(first.version).toBe(1);
    await writeFile(first.filePath, "");
    const second = await nextVersionedPath({ directory, baseName: "launch-16x9", extension: ".mp4" });
    expect(path.basename(second.filePath)).toBe("launch-16x9-v2.mp4");
  });
});
