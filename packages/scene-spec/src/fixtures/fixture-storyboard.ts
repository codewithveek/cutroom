import type { StoryboardInput } from "../storyboard";

/**
 * A hand-written storyboard for a fictional CLI ("Shipnote") that exercises every P0 block.
 * Used by video-kit stills, renderer tests and the M1 acceptance render.
 */
export const fixtureStoryboardInput: StoryboardInput = {
  id: "01JFIXTURESTORYBOARD000001",
  title: "Shipnote launch",
  videoType: "launch",
  look: "editorial",
  brand: { name: "Shipnote", tagline: "Release notes from your commits", url: "shipnote.dev" },
  seed: 7,
  scenes: [
    {
      id: "scene-problem",
      beat: "problem",
      block: "kinetic-headline",
      baseFrames: 90,
      props: { lines: ["Release notes take *an afternoon*", "and nobody reads them"], tone: "problem" },
      narration: [{ text: "Writing release notes takes an afternoon." }],
    },
    {
      id: "scene-introducing",
      beat: "introducing",
      block: "title-card",
      baseFrames: 75,
      transitionIn: "circle",
      props: { variant: "introducing", name: "Shipnote", tagline: "Release notes from your commits" },
      narration: [{ text: "Meet Shipnote.", say: "Meet Ship note." }],
    },
    {
      id: "scene-pitch",
      beat: "pitch",
      block: "feature-cards",
      baseFrames: 150,
      props: {
        heading: "What it does",
        cards: [
          { icon: "code", title: "Read commits", line: "Groups conventional commits by type" },
          { icon: "layers", title: "Draft notes", line: "Writes a markdown changelog per release" },
          { icon: "rocket", title: "Publish", line: "Posts the notes to GitHub Releases" },
        ],
      },
      narration: [{ text: "It reads your commits, drafts the notes and publishes them." }],
    },
    {
      id: "scene-terminal",
      beat: "moment",
      block: "terminal",
      baseFrames: 150,
      props: {
        title: "~/my-app",
        commands: [
          { command: "npx shipnote draft", output: ["Found 14 commits since v1.2.0", "Wrote CHANGELOG.md"] },
        ],
        charsPerSecond: 18,
      },
      narration: [{ text: "One command drafts the changelog." }],
    },
    {
      id: "scene-code",
      beat: "moment",
      block: "code-card",
      baseFrames: 150,
      transitionIn: "panel",
      props: {
        filePath: "src/group-commits.ts",
        language: "ts",
        lineStart: 1,
        lineEnd: 5,
        code: 'export function groupCommits(commits: Commit[]) {\n  return Object.groupBy(commits, (commit) => commit.type);\n}\n\nexport const commitTypes = ["feat", "fix", "perf"];',
        caption: "Grouped by commit type",
        reveal: "lines",
      },
      narration: [{ text: "Commits are grouped by type, straight from the history." }],
    },
    {
      id: "scene-number",
      beat: "moment",
      block: "big-number",
      baseFrames: 105,
      props: {
        label: "Commit types",
        value: 3,
        format: "integer",
        line: "feat, fix and perf, *grouped*",
        limitState: false,
      },
      narration: [{ text: "Three commit types, grouped for you." }],
    },
    {
      id: "scene-flow",
      beat: "pitch",
      block: "diagram-flow",
      baseFrames: 105,
      props: {
        heading: "How a release note gets written",
        nodes: [
          { icon: "search", label: "Read commits", detail: "git log" },
          { icon: "layers", label: "Group by type", detail: "group-commits.ts" },
          { icon: "check", label: "Write the changelog", detail: "CHANGELOG.md" },
        ],
        connectors: ["parse", "draft"],
      },
      narration: [{ text: "Commits in, grouped by type, written out as a changelog." }],
    },
    {
      id: "scene-audience",
      beat: "moment",
      block: "word-slot",
      baseFrames: 105,
      props: { lead: "Built for", items: ["solo founders", "open-source maintainers", "small teams"] },
      narration: [{ text: "Built for anyone who ships often." }],
    },
    {
      id: "scene-close",
      beat: "close",
      block: "end-card",
      baseFrames: 105,
      props: {
        verbs: ["Commit.", "Draft.", "Ship."],
        name: "Shipnote",
        tagline: "Release notes from your commits",
        cta: "npx shipnote",
        url: "shipnote.dev",
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
