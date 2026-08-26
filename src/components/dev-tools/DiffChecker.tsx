"use client";

import { useState } from "react";
import {
  createTwoFilesPatch,
  diffWordsWithSpace,
} from "diff";
import {
  buildSideBySideDiff,
  type DiffCell,
  type DiffResult,
} from "@/lib/dev-tools/diff";
import {
  decodeSharedDiffHash,
  encodeSharedDiff,
  MAX_SHARE_URL_LENGTH,
} from "@/lib/dev-tools/diff-share";

type Notice = {
  kind: "success" | "error";
  message: string;
};

const buttonClass =
  "inline-flex items-center justify-center rounded-sm border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export default function DiffChecker() {
  const [sharedDiff] = useState(() =>
    typeof window === "undefined"
      ? null
      : decodeSharedDiffHash(window.location.hash),
  );
  const [original, setOriginal] = useState(sharedDiff?.original ?? "");
  const [changed, setChanged] = useState(sharedDiff?.changed ?? "");
  const [result, setResult] = useState<DiffResult | null>(() =>
    sharedDiff
      ? buildSideBySideDiff(sharedDiff.original, sharedDiff.changed)
      : null,
  );
  const [notice, setNotice] = useState<Notice | null>(
    sharedDiff
      ? { kind: "success", message: "Shared comparison loaded." }
      : null,
  );

  const clearSharedHash = () => {
    if (window.location.hash.startsWith("#diff=")) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  };

  const updateText = (
    setter: (value: string) => void,
    value: string,
  ) => {
    clearSharedHash();
    setter(value);
    setResult(null);
    setNotice(null);
  };

  const compare = () => {
    setResult(buildSideBySideDiff(original, changed));
    setNotice(null);
  };

  const copyPatch = async () => {
    try {
      const patch = createTwoFilesPatch(
        "original.txt",
        "changed.txt",
        original,
        changed,
      );
      await navigator.clipboard.writeText(patch);
      setNotice({
        kind: "success",
        message: "Unified diff copied to clipboard.",
      });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
    }
  };

  const share = async () => {
    const encoded = encodeSharedDiff({ original, changed });
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#diff=${encoded}`;

    if (url.length > MAX_SHARE_URL_LENGTH) {
      setNotice({
        kind: "error",
        message:
          "This comparison is too large for a reliable share link. Download the diff instead.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", `#diff=${encoded}`);
      setNotice({
        kind: "success",
        message: "Share link copied to clipboard.",
      });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
    }
  };

  const downloadPatch = () => {
    const patch = createTwoFilesPatch(
      "original.txt",
      "changed.txt",
      original,
      changed,
    );
    const url = URL.createObjectURL(
      new Blob([patch], { type: "text/x-diff;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "comparison.diff";
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: "success", message: "Diff file downloaded." });
  };

  const swap = () => {
    clearSharedHash();
    setOriginal(changed);
    setChanged(original);
    setResult(null);
    setNotice(null);
  };

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>original text</span>
            <span>{lineCount(original)} lines</span>
          </span>
          <textarea
            value={original}
            onChange={(event) => updateText(setOriginal, event.target.value)}
            placeholder="Paste the original text..."
            spellCheck={false}
            className="min-h-72 w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-terminal-red/50 focus:border-terminal-red focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>changed text</span>
            <span>{lineCount(changed)} lines</span>
          </span>
          <textarea
            value={changed}
            onChange={(event) => updateText(setChanged, event.target.value)}
            placeholder="Paste the changed text..."
            spellCheck={false}
            className="min-h-72 w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/50 focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={compare}
          className={`${buttonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
        >
          find differences
        </button>
        <button
          type="button"
          onClick={swap}
          disabled={!original && !changed}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          swap sides
        </button>
        <button
          type="button"
          onClick={copyPatch}
          disabled={!result}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          copy unified diff
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!original && !changed}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          share link
        </button>
        <button
          type="button"
          onClick={downloadPatch}
          disabled={!result}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          download .diff
        </button>
        <button
          type="button"
          onClick={() => {
            clearSharedHash();
            setOriginal("");
            setChanged("");
            setResult(null);
            setNotice(null);
          }}
          disabled={!original && !changed}
          className={`${buttonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
        >
          clear
        </button>
      </div>

      <div className="mt-4 min-h-6 text-xs" aria-live="polite">
        {notice ? (
          <p
            className={
              notice.kind === "error" ? "text-terminal-red" : "text-accent"
            }
          >
            <span className="mr-2">
              [{notice.kind === "error" ? "error" : "ok"}]
            </span>
            {notice.message}
          </p>
        ) : (
          <p className="text-muted">
            <span className="mr-2 text-accent">[ready]</span>
            Comparison stays local. Share links contain both inputs, so remove
            secrets before sharing.
          </p>
        )}
      </div>

      {result ? <DiffOutput result={result} /> : null}
    </div>
  );
}

function DiffOutput({ result }: { result: DiffResult }) {
  const identical = result.additions === 0 && result.deletions === 0;

  return (
    <section className="mt-6" aria-label="Text comparison result">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs text-foreground">
          <span className="mr-2 text-accent">$</span>
          diff --side-by-side original.txt changed.txt
        </h2>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide">
          <span className="text-terminal-red">-{result.deletions}</span>
          <span className="text-accent">+{result.additions}</span>
        </div>
      </div>

      {identical ? (
        <div className="rounded-sm border border-accent/40 bg-accent-soft px-4 py-8 text-center text-sm text-accent">
          [identical] No differences found.
        </div>
      ) : (
        <div className="max-h-[42rem] overflow-auto rounded-sm border border-border bg-background/60">
          <div className="min-w-[720px]">
            <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border bg-surface-2 text-[10px] uppercase tracking-[0.14em] text-muted">
              <div className="border-r border-border px-3 py-2">original</div>
              <div className="px-3 py-2">changed</div>
            </div>

            {result.rows.map((row, index) => (
              <div
                key={`${row.left?.line ?? "x"}-${row.right?.line ?? "x"}-${index}`}
                className="grid grid-cols-2 border-b border-border/50 last:border-0"
              >
                <DiffCellView
                  cell={row.left}
                  otherText={row.right?.text}
                  side="left"
                />
                <DiffCellView
                  cell={row.right}
                  otherText={row.left?.text}
                  side="right"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DiffCellView({
  cell,
  otherText,
  side,
}: {
  cell?: DiffCell;
  otherText?: string;
  side: "left" | "right";
}) {
  if (!cell) {
    return (
      <div
        className={`min-h-7 bg-surface-2/35 ${
          side === "left" ? "border-r border-border" : ""
        }`}
      />
    );
  }

  const changed = cell.kind !== "same";

  return (
    <div
      className={`grid min-h-7 grid-cols-[3rem_minmax(0,1fr)] ${
        side === "left" ? "border-r border-border" : ""
      } ${
        cell.kind === "removed"
          ? "bg-terminal-red/10"
          : cell.kind === "added"
            ? "bg-accent-soft"
            : ""
      }`}
    >
      <span className="border-r border-border/60 px-2 py-1 text-right text-[10px] text-muted select-none">
        {cell.line}
      </span>
      <code className="min-w-0 whitespace-pre-wrap px-2 py-1 text-[11px] [overflow-wrap:anywhere]">
        {changed && otherText !== undefined ? (
          <WordDiff
            original={side === "left" ? cell.text : otherText}
            changed={side === "right" ? cell.text : otherText}
            side={side}
          />
        ) : (
          cell.text || " "
        )}
      </code>
    </div>
  );
}

function WordDiff({
  original,
  changed,
  side,
}: {
  original: string;
  changed: string;
  side: "left" | "right";
}) {
  return diffWordsWithSpace(original, changed)
    .filter((part) => (side === "left" ? !part.added : !part.removed))
    .map((part, index) => (
      <span
        key={`${part.value}-${index}`}
        className={
          part.added
            ? "bg-accent/25 text-accent"
            : part.removed
              ? "bg-terminal-red/20 text-terminal-red"
              : ""
        }
      >
        {part.value}
      </span>
    ));
}

function lineCount(value: string) {
  return value === "" ? 0 : value.split("\n").length;
}
