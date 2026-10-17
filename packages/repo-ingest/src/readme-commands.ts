const commandPrefixes =
  /^(?:\$\s*)?((?:npx|npm|pnpm|yarn|bun|bunx|pip|pipx|uv|poetry|cargo|go|brew|docker|make|curl|git|deno)\s.+)$/;

export interface ReadmeCommand {
  command: string;
  filePath: string;
  line: number;
}

/** Shell commands inside fenced code blocks: what the terminal block may type (PRD §7.7). */
export function extractReadmeCommands(content: string, filePath: string): ReadmeCommand[] {
  const commands: ReadmeCommand[] = [];
  let insideFence = false;
  content.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      insideFence = !insideFence;
      return;
    }
    if (!insideFence) return;
    const match = line.match(commandPrefixes);
    if (match?.[1] && match[1].length <= 80) commands.push({ command: match[1], filePath, line: index + 1 });
  });
  return commands;
}
