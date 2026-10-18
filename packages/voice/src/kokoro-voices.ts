import type { VoiceOption } from "@cutroom/scene-spec";

/**
 * The Kokoro voices graded C or better on the model card, best first. Voice packs ship inside
 * kokoro-js, so every one works offline once `cutroom setup` has fetched the model weights.
 */
export const kokoroVoices: ReadonlyArray<VoiceOption> = [
  { id: "af_heart", provider: "kokoro", name: "Heart", accent: "American", gender: "female", grade: "A" },
  { id: "af_bella", provider: "kokoro", name: "Bella", accent: "American", gender: "female", grade: "A-" },
  { id: "af_nicole", provider: "kokoro", name: "Nicole", accent: "American", gender: "female", grade: "B-" },
  { id: "bf_emma", provider: "kokoro", name: "Emma", accent: "British", gender: "female", grade: "B-" },
  { id: "am_michael", provider: "kokoro", name: "Michael", accent: "American", gender: "male", grade: "C+" },
  { id: "am_fenrir", provider: "kokoro", name: "Fenrir", accent: "American", gender: "male", grade: "C+" },
  { id: "am_puck", provider: "kokoro", name: "Puck", accent: "American", gender: "male", grade: "C+" },
  { id: "af_sarah", provider: "kokoro", name: "Sarah", accent: "American", gender: "female", grade: "C+" },
  { id: "bm_george", provider: "kokoro", name: "George", accent: "British", gender: "male", grade: "C" },
  { id: "bm_fable", provider: "kokoro", name: "Fable", accent: "British", gender: "male", grade: "C" },
];
