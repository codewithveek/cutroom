import type { z } from "zod";
import type { keyFileRoleSchema } from "./snapshot-schema";

type KeyFileRole = z.infer<typeof keyFileRoleSchema>;

const keyFileRules: ReadonlyArray<{ role: KeyFileRole; pattern: RegExp }> = [
  { role: "readme", pattern: /^(readme)(\.[a-z]+)?$/i },
  {
    role: "manifest",
    pattern: /(^|\/)(package\.json|pyproject\.toml|cargo\.toml|go\.mod|gemfile|composer\.json|setup\.py)$/i,
  },
  { role: "route", pattern: /(^|\/)(app|pages|routes)\/.*\.(tsx?|jsx?|vue|svelte)$/ },
  { role: "route", pattern: /(^|\/)(routes?|controllers?|handlers?|api)\/[^/]+\.(ts|js|py|go|rb)$/ },
  { role: "i18n", pattern: /(^|\/)(locales?|i18n|lang|translations?|messages)\/.*\.(json|ya?ml)$/ },
  { role: "entry", pattern: /^(src\/)?(index|main|cli|server|app)\.(ts|tsx|js|py|go|rs)$/ },
  { role: "entry", pattern: /(^|\/)bin\/[^/]+$/ },
  { role: "config", pattern: /(^|\/)(tailwind\.config\.[a-z]+|globals?\.css|theme\.(ts|js|json))$/ },
  { role: "docs", pattern: /^docs\/.*\.mdx?$/ },
];

export function classifyKeyFile(relativePath: string): KeyFileRole | undefined {
  return keyFileRules.find((rule) => rule.pattern.test(relativePath))?.role;
}
