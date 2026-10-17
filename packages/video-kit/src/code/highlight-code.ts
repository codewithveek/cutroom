import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export interface CodeToken {
  content: string;
  color: string | undefined;
}

export type CodeTheme = "github-light" | "github-dark-dimmed";

/** Short names a storyboard may use, mapped to the grammars we bundle. */
const languageAliases: Readonly<Record<string, string>> = {
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  js: "javascript",
  javascript: "javascript",
  mjs: "javascript",
  jsx: "jsx",
  json: "json",
  sh: "shellscript",
  bash: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  py: "python",
  python: "python",
  go: "go",
  rs: "rust",
  rust: "rust",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  html: "html",
  sql: "sql",
  md: "markdown",
  markdown: "markdown",
};

let highlighterPromise: Promise<HighlighterCore> | undefined;

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark-dimmed.mjs")],
    langs: [
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/jsx.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/shellscript.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/markdown.mjs"),
    ],
    // The JavaScript regex engine avoids loading WebAssembly inside the render browser.
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

export function plainTokens(code: string): CodeToken[][] {
  return code.split("\n").map((line) => [{ content: line, color: undefined }]);
}

export interface HighlightCodeOptions {
  code: string;
  language: string;
  theme: CodeTheme;
}

export async function highlightCode(options: HighlightCodeOptions): Promise<CodeToken[][]> {
  const grammar = languageAliases[options.language.toLowerCase()];
  if (!grammar) return plainTokens(options.code);
  const highlighter = await getHighlighter();
  const result = highlighter.codeToTokens(options.code, { lang: grammar, theme: options.theme });
  return result.tokens.map((line) => line.map((token) => ({ content: token.content, color: token.color })));
}
