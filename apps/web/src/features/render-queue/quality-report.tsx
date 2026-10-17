"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiClient, type RunView } from "@/lib/api-client";

const audioReportSchema = z.object({
  peakDbfs: z.number(),
  rmsDbfs: z.number(),
  lowEnergyPercent: z.number(),
  integratedLufs: z.number().optional(),
  loudnessTimeline: z.array(z.object({ second: z.number(), lufs: z.number() })),
});
type AudioReport = z.infer<typeof audioReportSchema>;

const CHART_FLOOR_LUFS = -40;
const CHART_CEILING_LUFS = -6;

/** Momentary loudness per second, with the −16 LUFS target as a dashed line. */
function LoudnessSparkline(props: { timeline: AudioReport["loudnessTimeline"] }): React.ReactElement {
  const width = 240;
  const height = 48;
  const toY = (lufs: number) => {
    const clamped = Math.min(CHART_CEILING_LUFS, Math.max(CHART_FLOOR_LUFS, lufs));
    return height - ((clamped - CHART_FLOOR_LUFS) / (CHART_CEILING_LUFS - CHART_FLOOR_LUFS)) * height;
  };
  const step = width / Math.max(1, props.timeline.length - 1);
  const points = props.timeline
    .map((sample, index) => `${(index * step).toFixed(1)},${toY(sample.lufs).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Loudness over time"
      className="overflow-visible"
    >
      <title>Loudness over time</title>
      <line
        x1={0}
        x2={width}
        y1={toY(-16)}
        y2={toY(-16)}
        stroke="currentColor"
        strokeDasharray="3 3"
        className="text-ink-faint"
      />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-accent" />
    </svg>
  );
}

function AudioSummary(props: { url: string }): React.ReactElement | null {
  const [report, setReport] = useState<AudioReport>();
  useEffect(() => {
    void fetch(props.url)
      .then((response) => response.json())
      .then((body: unknown) => setReport(audioReportSchema.parse(body)));
  }, [props.url]);
  if (!report) return null;
  const facts: Array<[string, string]> = [
    ["Integrated", report.integratedLufs !== undefined ? `${report.integratedLufs.toFixed(1)} LUFS` : "–"],
    ["Peak", `${report.peakDbfs.toFixed(1)} dBFS`],
    ["Below 250 Hz", `${report.lowEnergyPercent.toFixed(0)}%`],
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      {facts.map(([label, value]) => (
        <div key={label}>
          <div className="text-ink-faint">{label}</div>
          <div className="font-mono">{value}</div>
        </div>
      ))}
      <LoudnessSparkline timeline={report.loudnessTimeline} />
    </div>
  );
}

/** Stills at scene ends and transition midpoints, and the audio report: what to judge by eye and ear (P7). */
export function QualityReport(props: { run: RunView; ratio: string }): React.ReactElement | null {
  const stills = props.run.assets.filter((asset) => asset.kind === "still" && asset.ratio === props.ratio);
  const audio = props.run.assets.find(
    (asset) => asset.kind === "audio-report" && asset.ratio === props.ratio,
  );
  if (stills.length === 0 && !audio) return null;
  return (
    <div className="space-y-3 border-t border-line pt-3">
      {audio ? <AudioSummary url={apiClient.assetUrl(audio.url)} /> : null}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {stills.map((still) => (
          <a
            key={still.id}
            href={apiClient.assetUrl(still.url)}
            target="_blank"
            rel="noreferrer"
            title={still.fileName}
            className="shrink-0"
          >
            {/* biome-ignore lint/performance/noImgElement: stills come from the local API, not a Next image host */}
            <img
              src={apiClient.assetUrl(still.url)}
              alt={still.fileName.replace(".jpg", "").replaceAll("-", " ")}
              className="h-16 rounded border border-line"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
