import type { Claim, ClaimCheck, Evidence } from "@cutroom/scene-spec";
import { stripStars } from "@cutroom/scene-spec";
import type { AuditContext, RepoTextIndex } from "../audit-context";
import { findOverclaims } from "../overclaim-lexicon";

export interface CheckOutcome {
  check: ClaimCheck;
  /** A failed check that alone makes the claim unsupported. */
  blocking: boolean;
  evidence?: Evidence[];
  suggestion?: string;
}

function lineNumberOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function findInRepo(index: RepoTextIndex, needle: string, wholeToken: boolean): Evidence | undefined {
  const pattern = wholeToken
    ? new RegExp(`(?<![\\w.])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`)
    : undefined;
  for (const file of index.files) {
    const position = pattern ? (file.content.match(pattern)?.index ?? -1) : file.content.indexOf(needle);
    if (position < 0) continue;
    const line = lineNumberOf(file.content, position);
    const excerpt = (file.content.split("\n")[line - 1] ?? needle).trim().slice(0, 400);
    return { filePath: file.path, lineStart: line, lineEnd: line, excerpt };
  }
  return undefined;
}

/** Quoted strings in claim text are UI labels: they must exist verbatim (FR-CA-2a). */
export function checkQuotedLabels(claim: Claim, index: RepoTextIndex): CheckOutcome[] {
  const quoted = [...stripStars(claim.text).matchAll(/["“']([^"”']{2,60})["”']/g)].map(
    (match) => match[1] ?? "",
  );
  return quoted.map((label) => {
    const found = index.uiStrings.has(label) || findInRepo(index, label, false) !== undefined;
    return {
      check: {
        check: "ui-label",
        passed: found,
        detail: found ? `UI label "${label}" exists` : `No UI string "${label}" in the repo`,
      },
      blocking: !found,
      ...(found
        ? {}
        : { suggestion: `Use the label exactly as the UI spells it, or drop the quotes around "${label}".` }),
    };
  });
}

/** A code card shows the file's bytes, after redaction, exactly (FR-CA-2b). */
export async function checkCodeExcerpt(claim: Claim, context: AuditContext): Promise<CheckOutcome[]> {
  if (claim.kind !== "code-excerpt" || !claim.source) return [];
  const actual = await context.reader.readLines(claim.source);
  const matches = actual === claim.text;
  const detail =
    actual === undefined
      ? `${claim.source.filePath}:${claim.source.lineStart}-${claim.source.lineEnd} does not exist`
      : matches
        ? `Matches ${claim.source.filePath}:${claim.source.lineStart}-${claim.source.lineEnd} byte for byte`
        : `Differs from ${claim.source.filePath}:${claim.source.lineStart}-${claim.source.lineEnd}`;
  return [
    {
      check: { check: "code-excerpt", passed: matches, detail },
      blocking: !matches,
      ...(matches && actual ? { evidence: [{ ...claim.source, excerpt: actual.slice(0, 400) }] } : {}),
      ...(matches ? {} : { suggestion: "Copy the excerpt from the file exactly, or fix the line range." }),
    },
  ];
}

/** Numbers on screen must appear in the code (FR-CA-2c). */
export function checkNumbers(claim: Claim, index: RepoTextIndex): CheckOutcome[] {
  if (claim.kind === "code-excerpt") return [];
  const numbers =
    claim.kind === "number"
      ? [claim.text]
      : [...claim.text.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*(?![\w])/g)].map((match) => match[0]);
  return [...new Set(numbers)].map((numberText) => {
    const evidence =
      findInRepo(index, numberText.replaceAll(",", ""), true) ?? findInRepo(index, numberText, true);
    return {
      check: {
        check: "number",
        passed: evidence !== undefined,
        detail: evidence
          ? `${numberText} appears in ${evidence.filePath}:${evidence.lineStart}`
          : `${numberText} does not appear in the repo`,
      },
      blocking: evidence === undefined,
      ...(evidence
        ? { evidence: [evidence] }
        : { suggestion: `Use a number that appears in the code instead of ${numberText}.` }),
    };
  });
}

/** Terminal commands come from the README or package scripts; output must appear in the repo. */
export function checkCommand(claim: Claim, index: RepoTextIndex): CheckOutcome[] {
  if (claim.kind !== "command") return [];
  const isCommandLine = claim.fieldPath.endsWith(".command");
  const text = claim.text.trim();
  const evidence = isCommandLine && index.commands.has(text) ? undefined : findInRepo(index, text, false);
  const passed = (isCommandLine && index.commands.has(text)) || evidence !== undefined;
  return [
    {
      check: {
        check: "evidence-search",
        passed,
        detail: passed
          ? `"${text}" is in the docs or code`
          : `"${text}" is not in the README, scripts or code`,
      },
      blocking: !passed,
      ...(evidence ? { evidence: [evidence] } : {}),
      ...(passed ? {} : { suggestion: "Show a command and output that the README or code contains." }),
    },
  ];
}

export function checkUrl(claim: Claim, index: RepoTextIndex): CheckOutcome[] {
  if (claim.kind !== "url") return [];
  const bare = claim.text.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const evidence = findInRepo(index, bare, false);
  return [
    {
      check: {
        check: "evidence-search",
        passed: evidence !== undefined,
        detail: evidence ? `URL found in ${evidence.filePath}` : `URL ${bare} is not in the repo`,
      },
      blocking: evidence === undefined,
      ...(evidence
        ? { evidence: [evidence] }
        : { suggestion: "Use the homepage or URL from package.json or the README." }),
    },
  ];
}

/** Unqualified absolutes never block on their own; they make a claim weak (FR-CA-2d). */
export function checkOverclaims(claim: Claim): CheckOutcome[] {
  if (claim.kind === "code-excerpt" || claim.kind === "command") return [];
  return findOverclaims(stripStars(claim.text)).map((hit) => ({
    check: { check: "overclaim", passed: false, detail: `"${hit.word}" is unqualified` },
    blocking: false,
    suggestion: `Replace "${hit.word}": ${hit.advice}.`,
  }));
}

/** The product name and exact UI strings or commands need no model to confirm. */
export function isSelfEvident(claim: Claim, index: RepoTextIndex): boolean {
  const text = stripStars(claim.text).trim();
  if (index.productNames.has(text.toLowerCase())) return true;
  if (index.uiStrings.has(text)) return true;
  return index.commands.has(text);
}
