import { type CutroomEnv, envSchema } from "./env-schema";

export class InvalidConfigError extends Error {
  override readonly name = "InvalidConfigError";
  readonly issues: ReadonlyArray<string>;

  constructor(issues: ReadonlyArray<string>) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.issues = issues;
  }
}

/** Empty strings in .env files mean "unset", not "set to empty". */
function dropEmptyValues(source: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const definedEntries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "",
  );
  return Object.fromEntries(definedEntries);
}

export function parseEnv(source: Readonly<Record<string, string | undefined>>): CutroomEnv {
  const result = envSchema.safeParse(dropEmptyValues(source));
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new InvalidConfigError(issues);
  }
  return result.data;
}

let cachedEnv: CutroomEnv | undefined;

/** Reads process.env once; the app refuses to boot on invalid config. */
export function loadEnv(): CutroomEnv {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
