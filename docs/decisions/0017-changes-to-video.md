# 0017 · Changes-to-video: the toRef tree, added-line evidence, path sources only

- **Status:** accepted · 2026-10-18

## Context
PRD extension E2: a "what's new" video from a range of history, where every "new" claim is backed by lines the range added, and a refactor-only range makes no video.

## Decision
- **Snapshot the toRef tree, not the working copy.** `git archive <toSha> | tar -x` into the run folder, then the normal ingest. Only tracked files, exactly as released, so the claim audit runs against toRef (E2-5).
- **Path sources only.** A range needs history; git URLs are cloned shallow (depth 1) for pinned fixtures. The GitHub Action checks out with `fetch-depth: 0` and passes a path. A git or zip source with `changes` fails with a clear `source_unavailable`.
- **Evidence on added lines, checked in code.** Patches are shown to the model with new-file line numbers (`+   12| …`). Each change's evidence must verify against toRef and lie inside the file's added-line ranges, or it is dropped; a change left with none is dropped. Fixes are dropped unless `includeFixes`.
- **"New" claims.** In the audit, a claim worded as new (new, now, introduces, adds, launches) whose evidence is not on added lines becomes unsupported (`added-lines` check).
- **Nothing user-visible → no video.** Zero kept changes is `NoUserVisibleChangesError` (`no_user_visible_changes`), listing what was left out and why. Temporal does not retry it.
- **The change brief becomes the run's brief**, so planning, review and rendering are unchanged.
- **UI:** one `Whole product ▾` chip, shown only when the typed path is a repository with tags. "Changes since <tag>" means `<tag>..HEAD`. A custom range is CLI-only (`--changes a..b`): it would need a text field the extension's UI rules do not allow.

## Consequences
- Large ranges are cut to the model's budget, most-added files first; renames are treated as their new path.
- Tags with identical commit dates sort arbitrarily.
