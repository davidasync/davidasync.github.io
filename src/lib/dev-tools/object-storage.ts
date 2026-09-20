/**
 * Client for egarots (https://github.com/davidasync/egarots), an API-only object
 * store on Cloudflare Workers + Backblaze B2.
 *
 * Two tools share it: the Objects panel, which uploads whatever you hand it, and
 * the diff share link, which uploads one JSON blob. Both leave the browser, so
 * the limits below are mirrored from the service rather than guessed — a value
 * the service would reject is worth catching before it costs one of the 20
 * writes allowed per IP per minute.
 */

export const OBJECT_STORAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_OBJECT_STORAGE_URL ??
  "https://egarots.davidasync.workers.dev"
).replace(/\/+$/, "");

/** `MAX_OBJECT_BYTES` in the service: 1 MiB, measured in bytes, not characters. */
export const MAX_OBJECT_BYTES = 1024 * 1024;

/**
 * The service caps a TTL at its bucket lifecycle window, so 7 days is both the
 * maximum and the default. Nothing here asks for longer.
 */
export const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_TTL_SECONDS = MAX_TTL_SECONDS;

export const MAX_FILENAME_LENGTH = 255;

/** Generated ids are exactly 12 characters of `[A-Za-z0-9]`. */
export const OBJECT_ID_PATTERN = /^[A-Za-z0-9]{12}$/;

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const TTL_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "6 hours", seconds: 6 * 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: MAX_TTL_SECONDS },
];

/** The `201` body, which is where the id lives — `Location` is not read here. */
export type StoredObject = {
  id: string;
  url: string;
  size: number;
  contentType: string;
  filename?: string;
  createdAt: string;
  expireAt: string;
};

export type PutObjectInput = {
  /** A Blob/File, or the exact bytes. Either way `fetch` derives Content-Length,
   * which the service requires and answers `411` without. */
  body: Blob | Uint8Array<ArrayBuffer>;
  contentType: string;
  filename?: string;
  ttlSeconds: number;
};

export function objectUrl(id: string) {
  return `${OBJECT_STORAGE_BASE_URL}/${id}`;
}

export function isObjectId(id: string) {
  return OBJECT_ID_PATTERN.test(id);
}

export async function putObject(input: PutObjectInput): Promise<StoredObject> {
  const query = new URLSearchParams({ ttl: String(input.ttlSeconds) });
  if (input.filename) {
    query.set("filename", input.filename);
  }

  let response: Response;
  try {
    response = await fetch(`${OBJECT_STORAGE_BASE_URL}/api/objects?${query}`, {
      method: "POST",
      headers: { "Content-Type": input.contentType || DEFAULT_CONTENT_TYPE },
      // Sent as a Blob either way, so the browser always has a known length to
      // put in Content-Length — the header the service refuses a write without.
      body: input.body instanceof Blob ? input.body : new Blob([input.body]),
    });
  } catch {
    // fetch only rejects on a transport-level failure: offline, DNS, TLS, or a
    // blocked CORS preflight. Every status code is handled below.
    throw new Error(
      "Could not reach the object store. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(uploadErrorMessage(response.status, await readError(response)));
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isStoredObject(payload)) {
    throw new Error("The object store returned an unexpected response.");
  }

  return payload;
}

/**
 * Reads an object back. Returns the raw response — expiry reads as a `404` and
 * each caller words that differently — after one retry on a `429`, which is all
 * a 20-per-minute limiter needs to ride out a double-click.
 */
export async function getObject(id: string) {
  const request = () => fetch(objectUrl(id));

  const first = await request();
  if (first.status !== 429) return first;

  await new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });
  return request();
}

async function readError(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // A proxy or the edge can answer with HTML instead of the API's JSON.
  }
  return "";
}

function uploadErrorMessage(status: number, apiError: string) {
  switch (status) {
    case 403:
      // The service refuses a write it cannot attribute to an IP, which in
      // practice means it is not running behind Cloudflare.
      return "The object store refused the upload — it could not identify this client.";
    case 413:
      return `That is larger than the ${formatBytes(MAX_OBJECT_BYTES)} limit.`;
    case 429:
      return "Rate limited — the object store allows 20 uploads per minute. Wait a moment.";
    case 503:
      return "The object store could not save the file. Try again in a moment.";
    default:
      return apiError || `The object store rejected the upload (HTTP ${status}).`;
  }
}

function isStoredObject(value: unknown): value is StoredObject {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "url" in value &&
    typeof value.url === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "contentType" in value &&
    typeof value.contentType === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "expireAt" in value &&
    typeof value.expireAt === "string"
  );
}

const BYTE_UNITS = ["B", "KB", "MB"] as const;

/** Sizes here never exceed a mebibyte, so the ladder stops at MB. */
export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const rounded = unit === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en")} ${BYTE_UNITS[unit]}`;
}

export function formatTtl(seconds: number) {
  const preset = TTL_PRESETS.find((option) => option.seconds === seconds);
  return preset ? preset.label : `${seconds.toLocaleString("en")} seconds`;
}

/**
 * Trims a name down to what the service accepts: the basename, since a path is
 * reduced to one anyway, with control characters and an over-long tail removed
 * so a file picked from disk is never rejected for its name alone.
 */
export function normalizeFilename(raw: string) {
  const base = raw.trim().split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[\x00-\x1f\x7f]/g, "");

  if (clean === "" || clean === "." || clean === "..") return "";
  return clean.slice(0, MAX_FILENAME_LENGTH);
}
