/**
 * Features the editor is designed around but Cutroom cannot offer yet. Each has a home in the
 * UI (a tab, a panel section or a source mode) that renders only when its flag is on, so turning
 * one on is a contract + endpoint change, not a redesign.
 */
export const capabilities = {
  /** Script-to-motion: start a project from a written script instead of a repository. */
  scriptSource: false,
  /** Screen capture of the running app for screenshot-window scenes. */
  screenCapture: false,
  /** Model-generated imagery or b-roll in the Media tab. */
  generatedMedia: false,
  /** Cloned or custom voices beyond the Kokoro catalogue and ElevenLabs. */
  voiceCloning: false,
  /** Uploaded music beds (the contract has `music.kind = "uploaded"`; no upload flow yet). */
  musicUpload: false,
  /** Free-form timing edits. Off by design while narration drives timing (product invariant). */
  manualTiming: false,
} as const;

export type Capability = keyof typeof capabilities;

export function isEnabled(capability: Capability): boolean {
  return capabilities[capability];
}
