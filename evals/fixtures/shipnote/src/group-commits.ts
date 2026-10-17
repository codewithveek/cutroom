export function groupCommits(commits: Commit[]) {
  return Object.groupBy(commits, (commit) => commit.type);
}

export const commitTypes = ["feat", "fix", "perf"];

export interface Commit {
  type: string;
  subject: string;
  hash: string;
}
