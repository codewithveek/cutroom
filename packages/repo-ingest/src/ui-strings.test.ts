import { describe, expect, it } from "vitest";
import { extractUiStrings } from "./ui-strings";

describe("extractUiStrings", () => {
  it("finds JSX text and labelled attributes with line numbers", () => {
    const content = `export function Payouts() {\n  return (\n    <section>\n      <h1>Schedule payouts</h1>\n      <button aria-label="Send now">{count}</button>\n    </section>\n  );\n}`;
    const strings = extractUiStrings({
      filePath: "src/payouts.tsx",
      language: "tsx",
      content,
      isI18nFile: false,
    });
    expect(strings).toContainEqual({
      text: "Schedule payouts",
      filePath: "src/payouts.tsx",
      line: 4,
      kind: "jsx-text",
    });
    expect(strings).toContainEqual({
      text: "Send now",
      filePath: "src/payouts.tsx",
      line: 5,
      kind: "attribute",
    });
    expect(strings.some((uiString) => uiString.text.includes("count"))).toBe(false);
  });

  it("reads i18n values", () => {
    const content = JSON.stringify({ nav: { home: "Home", settings: "Account settings" } }, null, 2);
    const strings = extractUiStrings({
      filePath: "locales/en.json",
      language: "json",
      content,
      isI18nFile: true,
    });
    expect(strings.map((uiString) => uiString.text)).toEqual(["Home", "Account settings"]);
    expect(strings[1]?.line).toBe(4);
  });

  it("reads CLI commands and option help", () => {
    const content = `program\n  .command("draft")\n  .description("Draft release notes")\n  .option("--since <tag>", "Start from this tag");`;
    const strings = extractUiStrings({ filePath: "src/cli.ts", language: "ts", content, isI18nFile: false });
    const texts = strings.map((uiString) => uiString.text);
    expect(texts).toEqual(
      expect.arrayContaining(["draft", "Draft release notes", "--since <tag>", "Start from this tag"]),
    );
  });
});
