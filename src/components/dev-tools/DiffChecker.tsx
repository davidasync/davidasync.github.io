"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { diffWordsWithSpace } from "diff";
import {
  buildSideBySideDiff,
  type DiffCell,
  type DiffResult,
  type DiffRow,
} from "@/lib/dev-tools/diff";
import { openNodePng } from "@/lib/dev-tools/diff-screenshot";
import {
  downloadSharedDiff,
  encodeRemoteShare,
  encodeSharedDiff,
  isSharedDiffHash,
  MAX_SHARE_URL_LENGTH,
  parseSharedDiffHash,
  REMOTE_SHARE_TTL_DAYS,
  uploadSharedDiff,
} from "@/lib/dev-tools/diff-share";
import {
  clearToolSpec,
  readDiffSpec,
  writeDiffSpec,
} from "@/lib/dev-tools/storage";
import TextStats, { formatCount } from "./TextStats";

type Notice = {
  kind: "success" | "error";
  message: string;
};

const buttonClass =
  "inline-flex items-center justify-center rounded-sm border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export default function DiffChecker() {
  const [shareRef] = useState(() =>
    typeof window === "undefined"
      ? null
      : parseSharedDiffHash(window.location.hash),
  );
  const inlineShare = shareRef?.kind === "inline" ? shareRef.diff : null;
  const [original, setOriginal] = useState(inlineShare?.original ?? "");
  const [changed, setChanged] = useState(inlineShare?.changed ?? "");
  const [result, setResult] = useState<DiffResult | null>(() =>
    inlineShare
      ? buildSideBySideDiff(inlineShare.original, inlineShare.changed)
      : null,
  );
  const [notice, setNotice] = useState<Notice | null>(() => {
    if (inlineShare) {
      return { kind: "success", message: "Shared comparison loaded." };
    }
    if (shareRef?.kind === "remote") {
      return { kind: "success", message: "Loading shared comparison..." };
    }
    return null;
  });
  const [sharing, setSharing] = useState(false);
  const outputRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (shareRef?.kind === "remote") {
      let cancelled = false;

      void downloadSharedDiff(shareRef.id)
        .then((diff) => {
          if (cancelled) return;
          setOriginal(diff.original);
          setChanged(diff.changed);
          setResult(buildSideBySideDiff(diff.original, diff.changed));
          setNotice({
            kind: "success",
            message:
              `Shared comparison loaded. Remote links expire after ${REMOTE_SHARE_TTL_DAYS} days.`,
          });
        })
        .catch((error) => {
          if (cancelled) return;
          setNotice({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load this share link.",
          });
        });

      return () => {
        cancelled = true;
      };
    }

    if (shareRef) return;

    const timer = window.setTimeout(() => {
      const stored = readDiffSpec();
      if (!stored) return;

      setOriginal(stored.original);
      setChanged(stored.changed);
      setResult(buildSideBySideDiff(stored.original, stored.changed));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [shareRef]);

  const clearSharedHash = () => {
    if (isSharedDiffHash(window.location.hash)) {
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
    writeDiffSpec({ original, changed });
    setNotice(null);
  };

  const share = async () => {
    const path = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const inlineEncoded = encodeSharedDiff({ original, changed });
    const inlineUrl = `${path}#diff=${inlineEncoded}`;

    setSharing(true);
    setNotice({ kind: "success", message: "Creating share link..." });

    try {
      let encoded = inlineEncoded;
      let remote = false;

      if (inlineUrl.length > MAX_SHARE_URL_LENGTH) {
        encoded = encodeRemoteShare(await uploadSharedDiff({ original, changed }));
        remote = true;
      }

      const url = `${path}#diff=${encoded}`;
      window.history.replaceState(null, "", `#diff=${encoded}`);

      try {
        await navigator.clipboard.writeText(url);
        setNotice({
          kind: "success",
          message: remote
            ? `Share link copied. It is stored on dpaste.com and expires after ${REMOTE_SHARE_TTL_DAYS} days.`
            : "Share link copied to clipboard.",
        });
      } catch {
        setNotice({
          kind: "error",
          message: remote
            ? `Share link created (expires in ${REMOTE_SHARE_TTL_DAYS} days), but clipboard access was denied.`
            : "Share link created, but clipboard access was denied.",
        });
      }
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create a share link.",
      });
    } finally {
      setSharing(false);
    }
  };

  const screenshot = async () => {
    const node = outputRef.current;
    if (!node) return;

    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setNotice({
        kind: "error",
        message: "The browser blocked the new tab. Allow popups to view the PNG.",
      });
      return;
    }

    try {
      await openNodePng(node, tab);
      setNotice({
        kind: "success",
        message: "Difference image opened in a new tab.",
      });
    } catch {
      setNotice({
        kind: "error",
        message:
          "Unable to capture this comparison. Try a smaller diff.",
      });
    }
  };

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted">
            original text
          </span>
          <textarea
            value={original}
            onChange={(event) => updateText(setOriginal, event.target.value)}
            placeholder="Paste the original text..."
            spellCheck={false}
            className="min-h-72 w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-terminal-red/50 focus:border-terminal-red focus:outline-none"
          />
          <TextStats value={original} />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted">
            changed text
          </span>
          <textarea
            value={changed}
            onChange={(event) => updateText(setChanged, event.target.value)}
            placeholder="Paste the changed text..."
            spellCheck={false}
            className="min-h-72 w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/50 focus:border-accent focus:outline-none"
          />
          <TextStats value={changed} />
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
          onClick={() => void share()}
          disabled={sharing || (!original && !changed)}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          share link
        </button>
        <button
          type="button"
          onClick={() => void screenshot()}
          disabled={!result}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          open png
        </button>
        <button
          type="button"
          onClick={() => {
            clearSharedHash();
            clearToolSpec("diff");
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
            Comparison stays local until you share. Short links stay in the
            URL; larger ones go to dpaste.com and expire after{" "}
            {REMOTE_SHARE_TTL_DAYS} days. Remove secrets before sharing.
          </p>
        )}
      </div>

      {result ? <DiffOutput result={result} outputRef={outputRef} /> : null}
    </div>
  );
}

function DiffOutput({
  result,
  outputRef,
}: {
  result: DiffResult;
  outputRef: RefObject<HTMLElement | null>;
}) {
  const identical = result.additions === 0 && result.deletions === 0;

  return (
    <section
      ref={outputRef}
      className="mt-6"
      aria-label="Text comparison result"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs text-foreground">
          <span className="mr-2 text-accent">$</span>
          diff --side-by-side original.txt changed.txt
        </h2>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide">
          <span className="text-terminal-red">
            -{formatCount(result.deletions)}
          </span>
          <span className="text-accent">+{formatCount(result.additions)}</span>
          <span className="text-muted">chars</span>
        </div>
      </div>

      {identical ? (
        <div
          data-diff-capture
          className="rounded-sm border border-accent/40 bg-accent-soft px-4 py-8 text-center text-sm text-accent"
        >
          [identical] No differences found.
        </div>
      ) : (
        <div
          data-diff-capture
          data-diff-scroll
          className="max-h-[42rem] overflow-auto rounded-sm border border-border bg-background/60"
        >
          <div className="min-w-[720px]">
            <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border bg-surface-2 text-[10px] uppercase tracking-[0.14em] text-muted">
              <div className="border-r border-border px-3 py-2">original</div>
              <div className="px-3 py-2">changed</div>
            </div>

            {result.rows.map((row, index) => (
              <div
                key={`${row.left?.line ?? "x"}-${row.right?.line ?? "x"}-${index}`}
                data-diff-row={isChangedRow(row) ? "changed" : "same"}
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

function isChangedRow(row: DiffRow) {
  return row.left?.kind !== "same" || row.right?.kind !== "same";
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

