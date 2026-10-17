import { describe, expect, it } from "vitest";
import { isSecretFile, redactSecrets } from "./redaction";

describe("isSecretFile", () => {
  it("skips env files, keys and certs", () => {
    for (const filePath of [".env", "apps/web/.env.local", "certs/server.pem", "deploy/id_rsa", "tls.key"]) {
      expect(isSecretFile(filePath)).toBe(true);
    }
    expect(isSecretFile(".env.example")).toBe(true);
    expect(isSecretFile("src/environment.ts")).toBe(false);
  });
});

describe("redactSecrets", () => {
  const fakeGithubToken = `ghp_${"a1B2".repeat(9)}`;
  const fakeStripeKey = `sk_live_${"9".repeat(24)}`;

  it("replaces known token formats", () => {
    const source = `const token = "${fakeGithubToken}";\nstripe(${JSON.stringify(fakeStripeKey)});\nAKIAABCDEFGHIJKLMNOP`;
    const result = redactSecrets(source);
    expect(result.content).not.toContain(fakeGithubToken);
    expect(result.content).not.toContain(fakeStripeKey);
    expect(result.content).toContain("‹redacted:github-token›");
    expect(result.content).toContain("‹redacted:stripe-key›");
    expect(result.content).toContain("‹redacted:aws-access-key›");
    expect(result.redactions.map((redaction) => redaction.line)).toEqual([1, 2, 3]);
  });

  it("redacts generic assignments but keeps placeholders", () => {
    const result = redactSecrets(
      `apiKey: "Zx81kfj20aLq9"\npassword = "changeme"\nclientSecret: "your-secret-here"`,
    );
    expect(result.content).toContain('apiKey: "‹redacted:assigned-secret›"');
    expect(result.content).toContain('password = "changeme"');
    expect(result.content).toContain('clientSecret: "your-secret-here"');
  });

  it("redacts private key blocks and passwords in connection strings", () => {
    const pemHeader = ["-----BEGIN", "RSA PRIVATE KEY-----"].join(" ");
    const pemFooter = ["-----END", "RSA PRIVATE KEY-----"].join(" ");
    const result = redactSecrets(`${pemHeader}\nMIIE\n${pemFooter}\npostgres://app:s3cretpass@db/app`);
    expect(result.content).toContain("‹redacted:private-key›");
    expect(result.content.split("\n")).toHaveLength(4);
    expect(result.content).toContain("postgres://app:‹redacted:connection-string›@db/app");
  });

  it("leaves ordinary code untouched", () => {
    const source = "export function tokenize(input: string) {\n  return input.split(' ');\n}";
    expect(redactSecrets(source)).toEqual({ content: source, redactions: [] });
  });
});
