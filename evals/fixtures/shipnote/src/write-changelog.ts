import { writeFile } from "node:fs/promises";
import { commitTypes, type Commit } from "./group-commits";

const headings: Record<string, string> = { feat: "Features", fix: "Fixes", perf: "Performance" };

export async function writeChangelog(version: string, grouped: Partial<Record<string, Commit[]>>) {
  const sections = commitTypes
    .filter((type) => grouped[type]?.length)
    .map((type) => `### ${headings[type]}\n\n${(grouped[type] ?? []).map((commit) => `- ${commit.subject}`).join("\n")}`);
  await writeFile("CHANGELOG.md", `## ${version}\n\n${sections.join("\n\n")}\n`);
}
