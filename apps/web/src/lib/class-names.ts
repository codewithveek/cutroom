/** Joins class names, skipping falsy values. */
export function classNames(...names: ReadonlyArray<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
