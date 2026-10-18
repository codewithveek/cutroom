# 0012 · Editor-first UI, and room for script-to-motion

## Context

The first web app was a wizard and a long run page (timeline, renders, storyboard editor and brief stacked). It worked but did not feel like an editor, and the product will grow from repo-to-video into a general script-to-motion editor: a project may start from a written script with no repository at all.

## Decision

- **App shell.** A collapsible sidebar (Home, New video, Projects tree, Activity, Library, Styles, Settings) with a light/dark switch. Projects group runs by source; videos sit under their project. Run pages start with the rail so the editor gets the width.
- **Home is a composer, not an empty state.** One input for the source plus an optional direction, the few choices that matter (preset chips, privacy, look, ratios), the model in use, "continue where you left off", and a live setup checklist from `GET /system/status`. The full wizard stays at `/new`.
- **The run page is the editor.** Header with mode tabs (Script, Media, Text, Audio, Captions, Transitions) and the one next action; a script tree of scenes and narration lines; the live Remotion preview; a voice and style inspector with the claim audit; and a timeline with video, voice, music and caption tracks on one clock. Edits are local drafts with undo/redo until "Save & re-audit".
- **Narration still drives timing.** Clips reorder but never stretch; there is no trim handle. The `manualTiming` capability is off by design.
- **New contracts:** `direction` on the run request (redacted before the model sees it), `PATCH /runs/:id/settings` for voice and music until approval, `GET /voices` and `/voices/:id/sample` (Kokoro, local), `GET /system/status`, and run `media` (voice clips, logo) so the preview plays the real voice and the timeline draws real waveforms.
- **Provisions, not promises.** `apps/web/src/lib/capabilities.ts` lists features with a designed home that are off: `scriptSource`, `screenCapture`, `generatedMedia`, `voiceCloning`, `musicUpload`, `manualTiming`. The composer's source modes (`source-modes.ts`) already include a Script mode, and the editor tabs carry an optional `requires` capability. Nothing behind a flag renders.

## Script-to-motion path

1. `repoSourceSchema` gains `{ kind: "script", text }` (or a new `projectSourceSchema` union), with a `script` ingest step that produces a brief without code evidence.
2. The claim audit gains a "script" policy: claims are checked against the script the user wrote rather than a repository.
3. Turn on `scriptSource`; the composer's Script mode and the Projects tree (keyed by source) already handle it.

## Consequences

- The run page is a client-heavy editor; every panel reads from one `EditorContext`.
- Voice samples synthesise once per voice (a few seconds) and are cached in the data directory.
- `scripts/screenshot-ui.ts` drives a whole run through the new UI and asserts each interaction (edit, undo, add scene, voice change, approve, render).
