/**
 * Client for nikednep (https://github.com/davidasync/nikednep), an API-only URL
 * shortener on Cloudflare Workers + KV.
 *
 * Unlike every other tool here, this one leaves the browser: the link has to be
 * stored somewhere to be resolvable later.
 */

export const SHORTENER_BASE_URL = (
  process.env.NEXT_PUBLIC_SHORTENER_URL ?? "https://nikednep.davidasync.workers.dev"
).replace(/\/+$/, "");

/** Mirrors `MAX_URL_LENGTH` in the service. Measured in characters, not bytes. */
export const MAX_URL_LENGTH = 8192;
export const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_TTL_SECONDS = 365 * 24 * 60 * 60;

/**
 * KV will not accept an expiry less than 60 seconds out, so the service rounds
 * anything shorter up to a minute while still reporting the TTL it was asked
 * for. Nothing below this is worth offering.
 */
export const MIN_USEFUL_TTL_SECONDS = 60;

const CODE_PATTERN = /^[a-zA-Z0-9]{3,32}$/;
const RESERVED_CODES = new Set(["api", "health"]);

export const TTL_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: DEFAULT_TTL_SECONDS },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { label: "1 year", seconds: MAX_TTL_SECONDS },
];

export type ShortenInput = {
  url: string;
  code: string;
  ttlSeconds: number;
};

export type ShortLink = {
  code: string;
  shortUrl: string;
  /** The original URL. The API does not echo it back, so it is kept from the request. */
  url: string;
  /** ISO 8601, as returned by the API. */
  expireAt: string;
  /** ISO 8601, recorded locally when the link was created. */
  createdAt: string;
};

/**
 * Re-checks what the service checks, so a bad URL or a reserved code is caught
 * before spending one of the 20 creates allowed per minute. Returns the message
 * to show, or null when the input is worth sending.
 */
export function validateShortenInput({ url, code, ttlSeconds }: ShortenInput) {
  const trimmedUrl = url.trim();

  if (trimmedUrl === "") {
    return "Enter a URL to shorten.";
  }
  if (trimmedUrl.length > MAX_URL_LENGTH) {
    return `URL must be at most ${MAX_URL_LENGTH.toLocaleString("en")} characters.`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return "URL must be an absolute http or https address.";
  }
  if (parsed.host === "" || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return "URL must be an absolute http or https address.";
  }

  const trimmedCode = code.trim();
  if (trimmedCode !== "") {
    if (RESERVED_CODES.has(trimmedCode.toLowerCase())) {
      return "That code is reserved. Pick another one.";
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      return "Custom code must be 3–32 letters or digits.";
    }
  }

  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    return "Pick an expiry between 1 second and 1 year.";
  }

  return null;
}

type ShortenResponse = {
  code: string;
  shortUrl: string;
  expireAt: string;
};

export async function shortenUrl(input: ShortenInput): Promise<ShortLink> {
  const url = input.url.trim();
  const code = input.code.trim();

  let response: Response;
  try {
    response = await fetch(`${SHORTENER_BASE_URL}/api/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        ...(code === "" ? {} : { code }),
        ttlSeconds: input.ttlSeconds,
      }),
    });
  } catch {
    // fetch only rejects on a transport-level failure: offline, DNS, TLS, or a
    // blocked CORS preflight. The status codes are all handled below.
    throw new Error(
      "Could not reach the shortener. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(errorMessage(response.status, await readError(response)));
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isShortenResponse(payload)) {
    throw new Error("The shortener returned an unexpected response.");
  }

  return {
    code: payload.code,
    shortUrl: payload.shortUrl,
    url,
    expireAt: payload.expireAt,
    createdAt: new Date().toISOString(),
  };
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

function errorMessage(status: number, apiError: string) {
  switch (status) {
    case 409:
      return "That code is already taken. Pick another one.";
    case 414:
      return `URL must be at most ${MAX_URL_LENGTH.toLocaleString("en")} characters.`;
    case 429:
      return "Rate limited — the shortener allows 20 links per minute. Wait a moment.";
    case 503:
      return "The shortener could not store the link. Try again in a moment.";
    default:
      return apiError || `The shortener rejected the request (HTTP ${status}).`;
  }
}

function isShortenResponse(value: unknown): value is ShortenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "shortUrl" in value &&
    typeof value.shortUrl === "string" &&
    "expireAt" in value &&
    typeof value.expireAt === "string"
  );
}

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

/** "in 7 days", or "expired" once the moment has passed. */
export function formatExpiry(expireAt: string, now = Date.now()) {
  const target = new Date(expireAt).getTime();
  if (Number.isNaN(target)) return "";

  const diff = target - now;
  if (diff <= 0) return "expired";

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), "second");
}

export function formatTtl(seconds: number) {
  const preset = TTL_PRESETS.find((option) => option.seconds === seconds);
  return preset ? preset.label : `${seconds.toLocaleString("en")} seconds`;
}
