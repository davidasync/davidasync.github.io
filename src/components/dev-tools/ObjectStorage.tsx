"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  DEFAULT_TTL_SECONDS,
  MAX_OBJECT_BYTES,
  OBJECT_STORAGE_BASE_URL,
  TTL_PRESETS,
  formatBytes,
  formatTtl,
  normalizeFilename,
  putObject,
  viewableUrl,
} from "@/lib/dev-tools/object-storage";
import { formatExpiry } from "@/lib/dev-tools/shortener";
import {
  scrollToOutput,
  usePrimaryAction,
} from "@/lib/dev-tools/use-primary-action";
import {
  MAX_STORED_LINKS,
  clearToolSpec,
  readObjectsSpec,
  writeObjectsSpec,
  type StoredUploadedObject,
} from "@/lib/dev-tools/storage";

type Notice = { kind: "success" | "error"; message: string };
type Mode = "file" | "text";

const headerButtonClass =
  "inline-flex items-center justify-center rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50";

const fieldClass =
  "w-full rounded-sm border border-border bg-background/70 p-3 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/40 focus:border-accent focus:outline-none";

const labelClass = "mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted";

const storeHost = OBJECT_STORAGE_BASE_URL.replace(/^https?:\/\//, "");

const TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";

export default function ObjectStorage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState(DEFAULT_TTL_SECONDS);
  const [objects, setObjects] = useState<StoredUploadedObject[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Deferred a tick for the same reason the other panels defer: reading
  // localStorage during the first render would not match the static HTML.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readObjectsSpec();
      if (!stored) return;

      setText(stored.text);
      setFilename(stored.filename);
      setTtlSeconds(stored.ttlSeconds);
      setObjects(stored.objects);
      // A File cannot be restored, so a stored draft always comes back as text.
      if (stored.text !== "") setMode("text");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Keeps "in 2 hours" from drifting into a lie while the panel sits open.
  useEffect(() => {
    if (objects.length === 0) return;

    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [objects.length]);

  const persist = (next: {
    text: string;
    filename: string;
    ttlSeconds: number;
    objects: StoredUploadedObject[];
  }) => {
    writeObjectsSpec(next);
  };

  // The bytes are only weighed here; the service weighs them again, and its
  // answer is the one that counts. This just saves a doomed round trip.
  const textBytes = mode === "text" ? new TextEncoder().encode(text).length : 0;
  const size = mode === "file" ? (file?.size ?? 0) : textBytes;
  const tooLarge = size > MAX_OBJECT_BYTES;
  const empty = mode === "file" ? file === null : text === "";

  const pickFile = (picked: File | null) => {
    setFile(picked);
    setNotice(null);
    if (picked) {
      setFilename(normalizeFilename(picked.name));
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const dropped = event.dataTransfer.files.item(0);
    if (dropped) {
      setMode("file");
      pickFile(dropped);
    }
  };

  const submit = async () => {
    if (empty) {
      setNotice({
        kind: "error",
        message:
          mode === "file" ? "Choose a file to upload." : "Enter some text to upload.",
      });
      return;
    }
    if (tooLarge) {
      setNotice({
        kind: "error",
        message: `That is ${formatBytes(size)} — the limit is ${formatBytes(MAX_OBJECT_BYTES)}.`,
      });
      return;
    }

    const name = normalizeFilename(filename);

    setPending(true);
    setNotice(null);

    try {
      const stored = await putObject({
        body: mode === "file" && file ? file : new TextEncoder().encode(text),
        contentType:
          mode === "file" && file
            ? file.type || "application/octet-stream"
            : TEXT_CONTENT_TYPE,
        filename: name || undefined,
        ttlSeconds,
      });

      const uploaded: StoredUploadedObject = {
        id: stored.id,
        url: stored.url,
        filename: stored.filename ?? "",
        contentType: stored.contentType,
        size: stored.size,
        expireAt: stored.expireAt,
        createdAt: stored.createdAt,
      };
      const nextObjects = [uploaded, ...objects].slice(0, MAX_STORED_LINKS);

      setObjects(nextObjects);
      setNow(Date.now());
      persist({ text, filename: name, ttlSeconds, objects: nextObjects });
      setNotice({
        kind: "success",
        message: `Uploaded ${formatBytes(uploaded.size)} — expires ${formatExpiry(uploaded.expireAt)}.`,
      });
      scrollToOutput(() => latestRef.current);
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unable to upload that object.",
      });
    } finally {
      setPending(false);
    }
  };

  usePrimaryAction(pending ? null : () => void submit());

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ kind: "success", message: "Object link copied to clipboard." });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
    }
  };

  const clearForm = () => {
    setFile(null);
    setText("");
    setFilename("");
    setTtlSeconds(DEFAULT_TTL_SECONDS);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    persist({ text: "", filename: "", ttlSeconds: DEFAULT_TTL_SECONDS, objects });
  };

  const clearHistory = () => {
    setObjects([]);
    setNotice(null);
    if (text === "" && filename === "" && ttlSeconds === DEFAULT_TTL_SECONDS) {
      clearToolSpec("objects");
    } else {
      persist({ text, filename, ttlSeconds, objects: [] });
    }
  };

  const latest = objects[0];

  return (
    <>
      <div className="mb-4 min-h-6 text-xs" aria-live="polite">
        {notice?.kind === "error" ? (
          <p className="text-terminal-red">
            <span className="mr-2">[error]</span>
            {notice.message}
          </p>
        ) : notice?.kind === "success" ? (
          <p className="text-accent">
            <span className="mr-2">[ok]</span>
            {notice.message}
          </p>
        ) : (
          <p className="text-muted">
            <span className="mr-2 text-terminal-yellow">[network]</span>
            This tool uploads the bytes to {storeHost}. Anyone with the link can
            read them — remove secrets first.
          </p>
        )}
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-3">
            <ModeToggle
              value={mode}
              onChange={(next) => {
                setMode(next);
                setNotice(null);
              }}
            />
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="submit"
                disabled={pending || empty}
                className={`${headerButtonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
              >
                {pending ? "uploading…" : "upload"}
              </button>
              <button
                type="button"
                onClick={clearForm}
                disabled={pending || (empty && filename === "")}
                className={`${headerButtonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
              >
                clear
              </button>
            </div>
          </div>

          {mode === "file" ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex min-h-32 flex-col items-center justify-center gap-3 rounded-sm border border-dashed p-6 text-center transition ${
                dragging
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-background/70"
              }`}
            >
              <p className="text-xs text-muted">
                {file
                  ? `${file.name} — ${formatBytes(file.size)}`
                  : "Drop a file here, or pick one."}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                aria-label="File to upload"
                onChange={(event) => pickFile(event.target.files?.item(0) ?? null)}
                className="block w-full max-w-sm text-[11px] text-muted file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-border file:bg-surface-2 file:px-2 file:py-1 file:text-[10px] file:uppercase file:tracking-wide file:text-muted hover:file:border-accent/60 hover:file:text-accent"
              />
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setNotice(null);
              }}
              aria-label="Text to upload"
              placeholder="Paste the text to store..."
              spellCheck={false}
              rows={8}
              className={`${fieldClass} resize-y`}
            />
          )}

          <p
            className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${
              tooLarge ? "text-terminal-red" : "text-muted"
            }`}
          >
            {formatBytes(size)} / {formatBytes(MAX_OBJECT_BYTES)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="objects-filename">
              filename — optional
            </label>
            <input
              id="objects-filename"
              value={filename}
              onChange={(event) => {
                setFilename(event.target.value);
                setNotice(null);
              }}
              placeholder="notes.txt"
              spellCheck={false}
              autoComplete="off"
              className={fieldClass}
            />
            <p className="mt-2 text-[10px] tracking-[0.06em] text-muted">
              Names the download. Text and images open in a tab; everything
              else downloads.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="objects-ttl">
              expires after
            </label>
            <select
              id="objects-ttl"
              value={ttlSeconds}
              onChange={(event) => {
                setTtlSeconds(Number(event.target.value));
                setNotice(null);
              }}
              className={fieldClass}
            >
              {TTL_PRESETS.map((preset) => (
                <option key={preset.seconds} value={preset.seconds}>
                  {preset.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] tracking-[0.06em] text-muted">
              The object is unreadable after {formatTtl(ttlSeconds)}.
            </p>
          </div>
        </div>
      </form>

      {latest ? (
        <div
          ref={latestRef}
          className="mt-6 scroll-mt-20 rounded-sm border border-accent/50 bg-accent-soft/50 p-4"
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            newest object
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <a
              href={viewableUrl(latest.url, latest.contentType)}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-sm text-accent underline decoration-dotted underline-offset-4 hover:brightness-110"
            >
              {latest.url}
            </a>
            <button
              type="button"
              onClick={() => void copy(latest.url)}
              className={`${headerButtonClass} border-accent/60 bg-accent-soft text-accent hover:border-accent`}
            >
              copy
            </button>
          </div>
          <p className="mt-2 break-all text-[11px] leading-5 text-muted">
            → {latest.filename || "«unnamed»"} · {latest.contentType}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
            {formatBytes(latest.size)} · expires {formatExpiry(latest.expireAt, now)}
          </p>
        </div>
      ) : null}

      {objects.length > 1 ? (
        <div className="mt-6">
          <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              earlier objects — this browser only
            </span>
            <button
              type="button"
              onClick={clearHistory}
              className={`${headerButtonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
            >
              clear history
            </button>
          </div>

          <ul className="divide-y divide-border rounded-sm border border-border bg-surface-2/70">
            {objects.slice(1).map((object) => (
              <li
                key={`${object.id}-${object.createdAt}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <a
                    href={viewableUrl(object.url, object.contentType)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-xs text-accent underline decoration-dotted underline-offset-4 hover:brightness-110"
                  >
                    {object.url}
                  </a>
                  <p className="mt-1 truncate text-[11px] text-muted">
                    {object.filename || "«unnamed»"} · {formatBytes(object.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
                    {formatExpiry(object.expireAt, now)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copy(object.url)}
                    className={`${headerButtonClass} border-border text-muted hover:border-accent/60 hover:text-accent`}
                  >
                    copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (value: Mode) => void;
}) {
  return (
    <div
      className="flex rounded-sm border border-border bg-background/60 p-0.5"
      aria-label="Upload source"
    >
      {(["file", "text"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded-sm px-3 py-1.5 text-[10px] uppercase tracking-wide transition ${
            value === item
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
