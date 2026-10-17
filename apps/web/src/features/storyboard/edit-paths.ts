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

interface SetSegmentsOptions {
  value: unknown;
  segments: ReadonlyArray<PathSegment>;
  nextValue: unknown;
}

function setSegments({ value, segments, nextValue }: SetSegmentsOptions): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return nextValue;
  const container: unknown = value ?? (typeof head === "number" ? [] : {});
  if (Array.isArray(container)) {
    const copy = [...container];
    copy[Number(head)] = setSegments({ value: copy[Number(head)], segments: rest, nextValue });
    return copy;
  }
  const record = container as Record<string, unknown>;
  return { ...record, [head]: setSegments({ value: record[head], segments: rest, nextValue }) };
}

export interface SetAtPathOptions<Value> {
  value: Value;
  path: string;
  nextValue: unknown;
}

/** Immutable set: `setAtPath({ value: scene, path: "props.lines.0", nextValue: "New" })` returns a changed copy. */
export function setAtPath<Value>(options: SetAtPathOptions<Value>): Value {
  return setSegments({
    value: options.value,
    segments: parsePath(options.path),
    nextValue: options.nextValue,
  }) as Value;
}

export interface MoveItemOptions<Item> {
  items: ReadonlyArray<Item>;
  fromIndex: number;
  toIndex: number;
}

export function moveItem<Item>({ items, fromIndex, toIndex }: MoveItemOptions<Item>): Item[] {
  if (toIndex < 0 || toIndex >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  if (moved !== undefined) copy.splice(toIndex, 0, moved);
  return copy;
}
