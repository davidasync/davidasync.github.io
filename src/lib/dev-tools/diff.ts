import { diffArrays, diffChars } from "diff";

export type DiffCell = {
  line: number;
  text: string;
  kind: "same" | "removed" | "added";
};

export type DiffRow = {
  left?: DiffCell;
  right?: DiffCell;
};

export type DiffResult = {
  rows: DiffRow[];
  additions: number;
  deletions: number;
};

export function buildSideBySideDiff(
  original: string,
  changed: string,
): DiffResult {
  const [left, right] = canonicalizePair(original, changed);
  const changes = diffArrays(textLines(left), textLines(right));
  const rows: DiffRow[] = [];
  let originalLine = 1;
  let changedLine = 1;

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];

    if (!change.added && !change.removed) {
      for (const text of change.value) {
        rows.push({
          left: { line: originalLine, text, kind: "same" },
          right: { line: changedLine, text, kind: "same" },
        });
        originalLine += 1;
        changedLine += 1;
      }
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];

    while (
      index < changes.length &&
      (changes[index].added || changes[index].removed)
    ) {
      const current = changes[index];
      if (current.removed) removed.push(...current.value);
      if (current.added) added.push(...current.value);
      index += 1;
    }

    index -= 1;

    for (
      let lineIndex = 0;
      lineIndex < Math.max(removed.length, added.length);
      lineIndex += 1
    ) {
      const removedText = removed[lineIndex];
      const addedText = added[lineIndex];
      const row: DiffRow = {};

      if (removedText !== undefined) {
        row.left = {
          line: originalLine,
          text: removedText,
          kind: "removed",
        };
        originalLine += 1;
      }

      if (addedText !== undefined) {
        row.right = {
          line: changedLine,
          text: addedText,
          kind: "added",
        };
        changedLine += 1;
      }

      rows.push(row);
    }
  }

  const { additions, deletions } = countCharChanges(left, right);
  return { rows, additions, deletions };
}

/** When both sides are JSON, sort object keys so key order is ignored. */
function canonicalizePair(original: string, changed: string): [string, string] {
  const left = tryCanonicalJson(original);
  const right = tryCanonicalJson(changed);
  if (left === null || right === null) return [original, changed];
  return [left, right];
}

function tryCanonicalJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.stringify(sortJsonKeys(JSON.parse(trimmed)), null, 2);
  } catch {
    return null;
  }
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortJsonKeys(record[key])]),
    );
  }

  return value;
}

function countCharChanges(original: string, changed: string) {
  let additions = 0;
  let deletions = 0;

  for (const part of diffChars(original, changed)) {
    if (part.added) additions += part.value.length;
    if (part.removed) deletions += part.value.length;
  }

  return { additions, deletions };
}

function textLines(value: string) {
  return value === "" ? [] : value.split(/\r\n|\n|\r/);
}
