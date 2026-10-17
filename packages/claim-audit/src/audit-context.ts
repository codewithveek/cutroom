import type { SnapshotReader } from "@cutroom/repo-ingest";
import type { ProductBrief } from "@cutroom/scene-spec";

/** What every check may look at: the redacted repo and the verified brief. */
export interface AuditContext {
  reader: SnapshotReader;
  brief: ProductBrief;
}

export interface RepoTextIndex {
  /** Every UI string, exactly as found. */
  uiStrings: ReadonlySet<string>;
  /** Commands the docs or scripts show. */
  commands: ReadonlySet<string>;
  /** Full redacted text of every file, for number and phrase searches. */
  files: ReadonlyArray<{ path: string; content: string }>;
  /** Names the product goes by. */
  productNames: ReadonlySet<string>;
}

const packageRunners = ["npm run", "pnpm", "pnpm run", "yarn", "bun run"];

export async function buildRepoTextIndex(context: AuditContext): Promise<RepoTextIndex> {
  const { snapshot } = context.reader;
  const files: Array<{ path: string; content: string }> = [];
  for (const file of snapshot.files) {
    const content = await context.reader.readFile(file.path);
    if (content !== undefined) files.push({ path: file.path, content });
  }
  const commands = new Set(snapshot.readmeCommands.map((command) => command.command.trim()));
  for (const scriptName of Object.keys(snapshot.scripts)) {
    for (const runner of packageRunners) commands.add(`${runner} ${scriptName}`);
  }
  const productNames = new Set(
    [context.brief.name, snapshot.packageName, snapshot.rootName]
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLowerCase()),
  );
  return {
    uiStrings: new Set(snapshot.uiStrings.map((uiString) => uiString.text)),
    commands,
    files,
    productNames,
  };
}
