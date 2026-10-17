type PathSegment = string | number;

function parsePath(path: string): PathSegment[] {
  return path.split(".").map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

export function getAtPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of parsePath(path)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return current;
}

function setSegments(value: unknown, segments: ReadonlyArray<PathSegment>, nextValue: unknown): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return nextValue;
  const container: unknown = value ?? (typeof head === "number" ? [] : {});
  if (Array.isArray(container)) {
    const copy = [...container];
    copy[Number(head)] = setSegments(copy[Number(head)], rest, nextValue);
    return copy;
  }
  const record = container as Record<string, unknown>;
  return { ...record, [head]: setSegments(record[head], rest, nextValue) };
}

/** Immutable set: `setAtPath(scene, "props.lines.0", "New")` returns a changed copy. */
export function setAtPath<Value>(value: Value, path: string, nextValue: unknown): Value {
  return setSegments(value, parsePath(path), nextValue) as Value;
}

export function moveItem<Item>(items: ReadonlyArray<Item>, fromIndex: number, toIndex: number): Item[] {
  if (toIndex < 0 || toIndex >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  if (moved !== undefined) copy.splice(toIndex, 0, moved);
  return copy;
}
