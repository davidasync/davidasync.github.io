import { diffArrays } from "diff";

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
  const changes = diffArrays(textLines(original), textLines(changed));
  const rows: DiffRow[] = [];
  let additions = 0;
  let deletions = 0;
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
    additions += added.length;
    deletions += removed.length;

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

  return { rows, additions, deletions };
}

function textLines(value: string) {
  return value === "" ? [] : value.split(/\r\n|\n|\r/);
}
