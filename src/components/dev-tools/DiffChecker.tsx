"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { diffWordsWithSpace } from "diff";
import {
  buildSideBySideDiff,
  type DiffCell,
  type DiffResult,
  type DiffRow,
} from "@/lib/dev-tools/diff";
import {
  DiffTooLargeError,
  openNodePng,
  prewarmPngCapture,
} from "@/lib/dev-tools/diff-screenshot";
import {
  downloadSharedDiff,
  encodeRemoteShare,
  encodeSharedDiff,
  isSharedDiffHash,
  MAX_SHARE_URL_LENGTH,
  parseSharedDiffHash,
  REMOTE_SHARE_HOST,
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
  /** The last link built here, kept on screen so it survives a denied
   * clipboard and can be read back before it is sent to anyone. */
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Inlining the web fonts is the slowest part of a capture and never
  // changes, so resolve it while the user is still reading the diff.
  useEffect(() => {
    if (result) prewarmPngCapture();
  }, [result]);
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
    setShareUrl(null);
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
    setShareUrl(null);
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
      setShareUrl(url);

      try {
        await navigator.clipboard.writeText(url);
        setNotice({
          kind: "success",
          message: remote
            ? `Share link copied. It is stored on ${REMOTE_SHARE_HOST} and expires after ${REMOTE_SHARE_TTL_DAYS} days.`
            : "Share link copied to clipboard.",
        });
      } catch {
        setNotice({
          kind: "error",
          message: remote
            ? `Share link created (expires in ${REMOTE_SHARE_TTL_DAYS} days), but clipboard access was denied — copy it below.`
            : "Share link created, but clipboard access was denied — copy it below.",
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

  const copyShareUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice({ kind: "success", message: "Share link copied to clipboard." });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
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

    tab.document.write(
      "<title>Rendering diff...</title>" +
        "<body style=\"margin:0;display:grid;place-items:center;height:100vh;" +
        "background:#0c0a0d;color:#8a8590;font:14px ui-monospace,monospace\">" +
        "[rendering] Building the comparison image...</body>",
    );
    tab.document.close();

    setCapturing(true);
    try {
      await openNodePng(node, tab);
      setNotice({
        kind: "success",
        message: "Difference image opened in a new tab.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof DiffTooLargeError
            ? "Too many changed lines to fit in one image. Compare a smaller section."
            : "Unable to capture this comparison. Try a smaller diff.",
      });
    } finally {
      setCapturing(false);
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
          disabled={!result || capturing}
          className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
        >
          {capturing ? "rendering png..." : "open png"}
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
            setShareUrl(null);
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
            URL; larger ones go to {REMOTE_SHARE_HOST} and expire after{" "}
            {REMOTE_SHARE_TTL_DAYS} days. Remove secrets before sharing.
          </p>
        )}
      </div>

      {shareUrl ? (
        <div className="mt-3 rounded-sm border border-accent/50 bg-accent-soft/50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
              share link
            </span>
            <button
              type="button"
              onClick={() => void copyShareUrl()}
              className="inline-flex items-center justify-center rounded-sm border border-accent/60 bg-accent-soft px-2 py-1 text-[10px] uppercase tracking-wide text-accent transition hover:border-accent"
            >
              copy
            </button>
          </div>
          {/* An input rather than wrapped text: an inline link runs to the
              2,000 characters of MAX_SHARE_URL_LENGTH, which would push the
              comparison itself off the screen. This scrolls and stays one
              line, and a click still selects the whole thing. */}
          <input
            value={shareUrl}
            readOnly
            aria-label="Share link"
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-sm border border-border bg-background/70 p-2 text-[11px] leading-5 text-foreground focus:border-accent focus:outline-none"
          />
        </div>
      ) : null}

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
  const scrollRef = useRef<HTMLDivElement>(null);

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
        <div className="flex overflow-hidden rounded-sm border border-border">
          <div
            ref={scrollRef}
            data-diff-capture
            data-diff-scroll
            className="max-h-[42rem] min-w-0 flex-1 overflow-auto bg-background/60"
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

          <DiffMinimap scrollRef={scrollRef} rows={result.rows} />
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

type Marker = {
  /** Fraction of the scrollable content, 0-1. */
  start: number;
  end: number;
  /** Which pane the row touches, mirroring the two columns of the diff. */
  original: boolean;
  changed: boolean;
};

/**
 * The strip is split down the middle like the diff itself, so a tick sits under
 * the pane it belongs to. A third colour is not an option here: several themes
 * set --accent and --terminal-yellow to near-identical ambers.
 */
function markedSides(row: DiffRow) {
  // A missing cell is filler opposite an insertion or deletion, so the change
  // belongs to the other pane only.
  return {
    original: row.left != null && row.left.kind !== "same",
    changed: row.right != null && row.right.kind !== "same",
  };
}

/**
 * An overview strip beside the diff, one tick per changed line, so a long
 * comparison shows where its changes sit without scrolling through it.
 */
function DiffMinimap({
  scrollRef,
  rows,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  rows: DiffRow[];
}) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [viewport, setViewport] = useState<{ start: number; end: number } | null>(
    null,
  );
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    // Scrolling moves the viewport band but never the ticks, so the two are
    // tracked apart: re-measuring every row on each scroll event would rebuild
    // hundreds of nodes a frame.
    const trackViewport = () => {
      const total = scroll.scrollHeight;
      if (total <= 0) return;

      setViewport(
        scroll.clientHeight >= total
          ? null
          : {
              start: scroll.scrollTop / total,
              end: (scroll.scrollTop + scroll.clientHeight) / total,
            },
      );
    };

    const measure = () => {
      const total = scroll.scrollHeight;
      if (total <= 0) return;

      const base = scroll.getBoundingClientRect().top - scroll.scrollTop;
      const found: Marker[] = [];

      scroll
        .querySelectorAll<HTMLElement>("[data-diff-row]")
        .forEach((element, index) => {
          const row = rows[index];
          if (!row) return;

          const sides = markedSides(row);
          if (!sides.original && !sides.changed) return;

          const box = element.getBoundingClientRect();
          found.push({
            start: (box.top - base) / total,
            end: (box.bottom - base) / total,
            ...sides,
          });
        });

      setMarkers(found);
      trackViewport();
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    const content = scroll.firstElementChild;
    if (content) observer.observe(content);

    scroll.addEventListener("scroll", trackViewport, { passive: true });
    return () => {
      observer.disconnect();
      scroll.removeEventListener("scroll", trackViewport);
    };
  }, [rows, scrollRef]);

  const jumpTo = (event: ReactMouseEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    const track = trackRef.current;
    if (!scroll || !track) return;

    const box = track.getBoundingClientRect();
    const fraction = (event.clientY - box.top) / box.height;

    scroll.scrollTo({
      top: fraction * scroll.scrollHeight - scroll.clientHeight / 2,
      behavior: "smooth",
    });
  };

  if (markers.length === 0) return null;

  return (
    <div
      ref={trackRef}
      onClick={jumpTo}
      title={`${markers.length} changed ${
        markers.length === 1 ? "line" : "lines"
      } — click to jump`}
      className="relative w-3 shrink-0 cursor-pointer border-l border-border bg-surface-2/50"
    >
      {viewport ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 rounded-[1px] border-y border-muted/40 bg-foreground/10"
          style={{
            top: `${viewport.start * 100}%`,
            height: `${Math.max((viewport.end - viewport.start) * 100, 1)}%`,
          }}
        />
      ) : null}

      {markers.map((marker, index) => {
        const position = {
          top: `${marker.start * 100}%`,
          height: `max(2px, ${(marker.end - marker.start) * 100}%)`,
        };

        return (
          <div key={index} aria-hidden="true">
            {marker.original ? (
              <div
                className="absolute left-[1px] w-[4px] rounded-[1px] bg-terminal-red"
                style={position}
              />
            ) : null}
            {marker.changed ? (
              <div
                className="absolute right-[1px] w-[4px] rounded-[1px] bg-accent"
                style={position}
              />
            ) : null}
          </div>
        );
      })}
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

