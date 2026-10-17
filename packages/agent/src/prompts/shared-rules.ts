/** The accuracy rules every Cutroom prompt carries (PRD §5 P1). */
export const accuracyRules = [
  "Everything you state must be supported by the repository content you were given. Never invent features, UI, statuses, numbers, integrations or customers.",
  "Use the product's own names for things, spelled exactly as the code spells them.",
  "Prefer precise, modest wording. Avoid unqualified absolutes: globally, anywhere, instantly, real-time, any, all, never, always, automatic, effortless, secure.",
  "Evidence excerpts must be copied verbatim from the numbered lines you were shown, without the line-number prefix, and the line range must be the one you copied from.",
].join("\n- ");
