"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/components/dev-tools/TextStats";
import {
  DEFAULT_TTL_SECONDS,
  MAX_URL_LENGTH,
  SHORTENER_BASE_URL,
  TTL_PRESETS,
  formatExpiry,
  formatTtl,
  shortenUrl,
  validateShortenInput,
  type ShortLink,
} from "@/lib/dev-tools/shortener";
import {
  scrollToOutput,
  usePrimaryAction,
} from "@/lib/dev-tools/use-primary-action";
import {
  MAX_STORED_LINKS,
  clearToolSpec,
  readShortenSpec,
  writeShortenSpec,
} from "@/lib/dev-tools/storage";

type Notice = { kind: "success" | "error"; message: string };

const headerButtonClass =
  "inline-flex items-center justify-center rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50";

const fieldClass =
  "w-full rounded-sm border border-border bg-background/70 p-3 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/40 focus:border-accent focus:outline-none";

const labelClass = "mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted";

/** The host only, for the short-link preview — the scheme is noise at this size. */
const shortHost = SHORTENER_BASE_URL.replace(/^https?:\/\//, "");

export default function UrlShortener() {
  const latestRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState(DEFAULT_TTL_SECONDS);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readShortenSpec();
      if (!stored) return;

      setUrl(stored.url);
      setCode(stored.code);
      setTtlSeconds(stored.ttlSeconds);
      setLinks(stored.links);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Keeps "in 2 minutes" from drifting into a lie while the panel sits open.
  useEffect(() => {
    if (links.length === 0) return;

    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [links.length]);

  const persist = (next: {
    url: string;
    code: string;
    ttlSeconds: number;
    links: ShortLink[];
  }) => {
    writeShortenSpec(next);
  };

  const submit = async () => {
    const input = { url, code, ttlSeconds };
    const invalid = validateShortenInput(input);

    if (invalid) {
      setNotice({ kind: "error", message: invalid });
      return;
    }

    setPending(true);
    setNotice(null);

    try {
      const link = await shortenUrl(input);
      const nextLinks = [link, ...links].slice(0, MAX_STORED_LINKS);

      setLinks(nextLinks);
      setCode("");
      setNow(Date.now());
      persist({ url, code: "", ttlSeconds, links: nextLinks });
      setNotice({
        kind: "success",
        message: `Created ${link.shortUrl} — expires ${formatExpiry(link.expireAt)}.`,
      });
      scrollToOutput(() => latestRef.current);
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unable to shorten that URL.",
      });
    } finally {
      setPending(false);
    }
  };

  usePrimaryAction(pending ? null : () => void submit());

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ kind: "success", message: "Short link copied to clipboard." });
    } catch {
      setNotice({ kind: "error", message: "Clipboard access was denied." });
    }
  };

  const clearForm = () => {
    setUrl("");
    setCode("");
    setTtlSeconds(DEFAULT_TTL_SECONDS);
    setNotice(null);
    persist({ url: "", code: "", ttlSeconds: DEFAULT_TTL_SECONDS, links });
  };

  const clearHistory = () => {
    setLinks([]);
    setNotice(null);
    if (url === "" && code === "" && ttlSeconds === DEFAULT_TTL_SECONDS) {
      clearToolSpec("shorten");
    } else {
      persist({ url, code, ttlSeconds, links: [] });
    }
  };

  const urlLength = [...url].length;
  const tooLong = urlLength > MAX_URL_LENGTH;
  const latest = links[0];

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
            This tool sends the URL to {shortHost} — the only tool here that
            leaves your browser.
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
          <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              long url
            </span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="submit"
                disabled={pending || url.trim() === ""}
                className={`${headerButtonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
              >
                {pending ? "shortening…" : "shorten"}
              </button>
              <button
                type="button"
                onClick={clearForm}
                disabled={pending || (url === "" && code === "")}
                className={`${headerButtonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
              >
                clear
              </button>
            </div>
          </div>

          <textarea
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setNotice(null);
            }}
            aria-label="Long URL"
            placeholder="https://example.com/a/very/long/path?with=query"
            spellCheck={false}
            rows={3}
            className={`${fieldClass} resize-y`}
          />
          <p
            className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${
              tooLong ? "text-terminal-red" : "text-muted"
            }`}
          >
            {formatCount(urlLength)} / {formatCount(MAX_URL_LENGTH)} chars
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="shorten-code">
              custom code — optional
            </label>
            <input
              id="shorten-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setNotice(null);
              }}
              placeholder="3–32 letters or digits"
              spellCheck={false}
              autoComplete="off"
              className={fieldClass}
            />
            <p className="mt-2 truncate text-[10px] tracking-[0.06em] text-muted">
              {shortHost}/{code.trim() || "«generated»"}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="shorten-ttl">
              expires after
            </label>
            <select
              id="shorten-ttl"
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
              The link stops resolving after {formatTtl(ttlSeconds)}.
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
            newest link
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <a
              href={latest.shortUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-sm text-accent underline decoration-dotted underline-offset-4 hover:brightness-110"
            >
              {latest.shortUrl}
            </a>
            <button
              type="button"
              onClick={() => void copy(latest.shortUrl)}
              className={`${headerButtonClass} border-accent/60 bg-accent-soft text-accent hover:border-accent`}
            >
              copy
            </button>
          </div>
          <p className="mt-2 break-all text-[11px] leading-5 text-muted">
            → {latest.url}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
            expires {formatExpiry(latest.expireAt, now)}
          </p>
        </div>
      ) : null}

      {links.length > 1 ? (
        <div className="mt-6">
          <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
              earlier links — this browser only
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
            {links.slice(1).map((link) => (
              <li
                key={`${link.code}-${link.createdAt}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <a
                    href={link.shortUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-xs text-accent underline decoration-dotted underline-offset-4 hover:brightness-110"
                  >
                    {link.shortUrl}
                  </a>
                  <p className="mt-1 truncate text-[11px] text-muted">{link.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
                    {formatExpiry(link.expireAt, now)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copy(link.shortUrl)}
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
