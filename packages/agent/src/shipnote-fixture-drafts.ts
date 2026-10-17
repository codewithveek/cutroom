import type { ProductBriefDraft, StoryboardDraft } from "@cutroom/scene-spec";

/**
 * What a good model answers for the shipnote fixture (evals/fixtures/shipnote). Used by tests,
 * the scripted end-to-end run and demos without a GPU. Evidence matches the fixture files,
 * except where a test needs a relocated or rejected excerpt.
 */
export const shipnoteBriefDraft: ProductBriefDraft = {
  name: "Shipnote",
  tagline: "Release notes from your commits",
  audience: "Developers and maintainers who ship releases from a git repository",
  problem: "Writing release notes by hand takes time and gets skipped",
  promise: "Draft a markdown changelog from conventional commits with one command",
  features: [
    {
      title: "Group commits by type",
      description: "Groups conventional commits into feat, fix and perf sections",
      evidence: [
        {
          filePath: "src/group-commits.ts",
          lineStart: 1,
          lineEnd: 3,
          excerpt:
            "export function groupCommits(commits: Commit[]) {\n  return Object.groupBy(commits, (commit) => commit.type);\n}",
        },
      ],
    },
    {
      title: "Draft the changelog",
      description: "Writes CHANGELOG.md with one section per commit type",
      evidence: [
        {
          filePath: "src/write-changelog.ts",
          lineStart: 99,
          lineEnd: 100,
          // A real line of the fixture (cited at the wrong lines on purpose), not a template.
          // biome-ignore lint/suspicious/noTemplateCurlyInString: verbatim source code
          excerpt: 'await writeFile("CHANGELOG.md", `## ${version}\\n\\n${sections.join("\\n\\n")}\\n`);',
        },
      ],
    },
    {
      title: "Start from any tag",
      description: "The draft command takes a --since option",
      evidence: [{ filePath: "src/does-not-exist.ts", lineStart: 1, lineEnd: 1, excerpt: "--since" }],
    },
  ],
};

export const shipnoteStoryboardDraft: StoryboardDraft = {
  title: "Shipnote launch",
  scenes: [
    {
      beat: "problem",
      block: "kinetic-headline",
      props: { lines: ["Release notes eat *an afternoon*", "every single release"], tone: "problem" },
      narration: [{ text: "Release notes eat an afternoon." }],
    },
    {
      beat: "introducing",
      block: "title-card",
      props: { variant: "introducing", name: "Shipnote", tagline: "Release notes from your commits" },
      narration: [{ text: "Meet Shipnote.", say: "Meet Ship note." }],
    },
    {
      beat: "pitch",
      block: "feature-cards",
      props: {
        cards: [
          { icon: "layers", title: "Group commits", line: "feat, fix and perf, sorted for you" },
          { icon: "code", title: "Draft notes", line: "Writes CHANGELOG.md per release" },
          { icon: "terminal", title: "One command", line: "npx shipnote draft" },
        ],
      },
      narration: [{ text: "It groups your commits and drafts the changelog." }],
    },
    {
      beat: "moment",
      block: "code-card",
      props: {
        filePath: "src/group-commits.ts",
        language: "ts",
        lineStart: 1,
        lineEnd: 3,
        code: "export function groupCommits(commits: Commit[]) {\n    return Object.groupBy(commits, (commit) => commit.type);\n}",
        reveal: "lines",
      },
      narration: [{ text: "Commits are grouped by their conventional type." }],
    },
    {
      beat: "moment",
      block: "terminal",
      props: {
        title: "~/my-app",
        commands: [{ command: "npx shipnote draft", output: ["Wrote CHANGELOG.md"] }],
        charsPerSecond: 18,
      },
      narration: [{ text: "Run the draft command in your repo." }],
    },
    {
      beat: "moment",
      block: "kinetic-headline",
      props: { lines: ["One command writes", "your *CHANGELOG.md*"], tone: "promise" },
      narration: [{ text: "One command writes the changelog." }],
    },
    {
      beat: "close",
      block: "end-card",
      props: {
        verbs: ["Commit.", "Draft.", "Ship."],
        name: "Shipnote",
        tagline: "Release notes from your commits",
        cta: "npx shipnote draft",
      },
      narration: [
        {
          text: "Shipnote. Release notes from your commits.",
          say: "Ship note. Release notes from your commits.",
        },
      ],
    },
  ],
};
