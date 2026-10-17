import type { Commit } from "./group-commits";

const conventionalCommit = /^(?<type>[a-z]+)(\([^)]*\))?!?: (?<subject>.+)$/;

export function parseCommit(hash: string, message: string): Commit | undefined {
  const match = message.match(conventionalCommit);
  if (!match?.groups) return undefined;
  return { type: match.groups.type ?? "chore", subject: match.groups.subject ?? message, hash };
}
