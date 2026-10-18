import type { ChangeCommit } from "@cutroom/scene-spec";

type LineRange = [number, number];

/** Line numbers added in the new version of a file, from a unified diff, as inclusive ranges. */
export function addedLineRanges(patch: string): LineRange[] {
  const ranges: LineRange[] = [];
  let newLine = 0;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk?.[1]) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (newLine === 0 || line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      const last = ranges.at(-1);
      if (last && last[1] === newLine - 1) last[1] = newLine;
      else ranges.push([newLine, newLine]);
      newLine += 1;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      newLine += 1;
    }
  }
  return ranges;
}

export function isOnAddedLines(
  ranges: ReadonlyArray<LineRange>,
  lineStart: number,
  lineEnd: number,
): boolean {
  return ranges.some(([start, end]) => lineStart >= start && lineEnd <= end);
}

const conventional = /^(\w+)(?:\(([^)]{1,40})\))?(!)?:\s*(.+)$/;

/** `feat(cli)!: add --changes` → type, scope, breaking, subject (conventional commits). */
export function parseCommit(options: { sha: string; subject: string; body: string }): ChangeCommit {
  const match = options.subject.match(conventional);
  const breaking = Boolean(match?.[3]) || /BREAKING[ -]CHANGE/.test(options.body);
  if (!match?.[1] || !match[4]) return { sha: options.sha, subject: options.subject, breaking };
  return {
    sha: options.sha,
    type: match[1].toLowerCase().slice(0, 20),
    ...(match[2] ? { scope: match[2] } : {}),
    subject: match[4],
    breaking,
  };
}

/**
 * The CHANGELOG section for a release: under the heading that names the version (with or without
 * a leading "v"), else the newest versioned heading. Undefined when no heading has a version.
 */
export function changelogSectionFor(changelog: string, toRef: string): string | undefined {
  const version = toRef.replace(/^v/, "");
  const lines = changelog.split("\n");
  const headings = lines.flatMap((line, index) => {
    const level = line.match(/^(#{1,6}) /)?.[1]?.length;
    return level ? [{ index, level, text: line }] : [];
  });
  const start =
    headings.find((heading) => heading.text.includes(version)) ??
    headings.find((heading) => /\d+\.\d+/.test(heading.text));
  if (!start) return undefined;
  const end = headings.find((heading) => heading.index > start.index && heading.level <= start.level);
  return lines.slice(start.index, end?.index).join("\n").trim();
}
