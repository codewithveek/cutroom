export { extractBrandHints, isDarkColor } from "./brand-hints";
export { webUiFrameworks } from "./frameworks";
export { defaultIgnorePatterns } from "./ignore-rules";
export {
  DEFAULT_MAX_FILE_BYTES,
  type IngestRepositoryOptions,
  type IngestResult,
  ingestRepository,
} from "./ingest-repository";
export { detectLanguage } from "./languages";
export { extractReadmeCommands, type ReadmeCommand } from "./readme-commands";
export { isSecretFile, type RedactionResult, redactSecrets } from "./redaction";
export { PathOutsideSnapshotError, resolveInside, SnapshotReader } from "./snapshot-reader";
export {
  type BrandHints,
  type RepoSnapshot,
  repoSnapshotSchema,
  type SnapshotFile,
  type UiString,
  uiStringSchema,
} from "./snapshot-schema";
export { type RepoSource, repoSourceSchema, resolveSource, SourceError } from "./source";
export { extractUiStrings } from "./ui-strings";
export { type EvidenceVerification, normalizeWhitespace, verifyEvidence } from "./verify-evidence";
