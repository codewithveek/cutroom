/** Files that are never read at all: environment files, keys and certificates (FR-ING-3). */
const secretFilePatterns: ReadonlyArray<RegExp> = [
  /(^|\/)\.env(\..*)?$/,
  /(^|\/)\.envrc$/,
  /\.(pem|key|p12|pfx|crt|cer|der|jks|keystore|asc|gpg)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)credentials(\.json)?$/i,
  /(^|\/)secrets?\.(json|ya?ml|toml)$/i,
];

export function isSecretFile(relativePath: string): boolean {
  return secretFilePatterns.some((pattern) => pattern.test(relativePath));
}

interface SecretPattern {
  type: string;
  pattern: RegExp;
  /** Capture group holding the secret; 0 replaces the whole match. */
  group: number;
}

/** Common secret formats. Order matters: specific formats before generic assignments. */
const secretPatterns: ReadonlyArray<SecretPattern> = [
  {
    type: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    group: 0,
  },
  { type: "aws-access-key", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, group: 0 },
  { type: "github-token", pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g, group: 0 },
  { type: "github-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g, group: 0 },
  { type: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, group: 0 },
  { type: "stripe-key", pattern: /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}\b/g, group: 0 },
  { type: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, group: 0 },
  { type: "openai-key", pattern: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/g, group: 0 },
  { type: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, group: 0 },
  { type: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, group: 0 },
  { type: "connection-string", pattern: /\b[a-z+]+:\/\/[^\s:@/]+:([^\s@/]{6,})@/g, group: 1 },
  {
    type: "assigned-secret",
    pattern:
      /\b[A-Za-z0-9_]*(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|client[_-]?secret)[A-Za-z0-9_]*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    group: 1,
  },
];

export interface RedactionResult {
  content: string;
  redactions: ReadonlyArray<{ type: string; line: number }>;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (content.charCodeAt(cursor) === 10) line += 1;
  return line;
}

/** Placeholder values in examples are not secrets; leave them so code reads naturally. */
function looksLikePlaceholder(value: string): boolean {
  return /^(x+|\*+|\.+|<[^>]+>|\$\{[^}]+\}|your[-_].*|changeme|example.*|placeholder.*|process\.env\..*)$/i.test(
    value,
  );
}

function replaceMatches({
  content,
  secretPattern,
  found,
}: {
  content: string;
  secretPattern: SecretPattern;
  found: Array<{ type: string; line: number }>;
}): string {
  return content.replace(secretPattern.pattern, (...args: unknown[]) => {
    const match = String(args[0]);
    const offset = args.find((arg, index) => index > 0 && typeof arg === "number");
    const secret = secretPattern.group === 0 ? match : String(args[secretPattern.group] ?? "");
    if (!secret || secret.includes("‹redacted:") || looksLikePlaceholder(secret)) return match;
    found.push({
      type: secretPattern.type,
      line: lineNumberAt(content, typeof offset === "number" ? offset : 0),
    });
    // Keep the secret's line breaks so every line number in the file stays valid evidence.
    const preservedNewlines = "\n".repeat(secret.split("\n").length - 1);
    return match.replace(secret, `‹redacted:${secretPattern.type}›${preservedNewlines}`);
  });
}

/**
 * Replaces secrets with `‹redacted:type›` before content reaches a model, log or block.
 * Everything downstream reads only the redacted copy.
 */
export function redactSecrets(content: string): RedactionResult {
  const redactions: Array<{ type: string; line: number }> = [];
  let redacted = content;
  for (const secretPattern of secretPatterns)
    redacted = replaceMatches({ content: redacted, secretPattern, found: redactions });
  return { content: redacted, redactions: redactions.toSorted((left, right) => left.line - right.line) };
}
