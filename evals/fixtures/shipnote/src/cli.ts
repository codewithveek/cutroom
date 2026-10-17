import { Command } from "commander";

const program = new Command("shipnote");

program
  .command("draft")
  .description("Draft release notes from your commits")
  .option("--since <tag>", "Start from this tag instead of the latest one")
  .action(async () => {
    console.log("Wrote CHANGELOG.md");
  });

program.parse();
