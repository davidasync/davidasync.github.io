import LZString from "lz-string";

export const MAX_SHARE_URL_LENGTH = 2_000;
const MAX_INLINE_HASH_LENGTH = 100_000;
export const SHARE_HASH_PREFIX = "#diff=";
export const REMOTE_SHARE_PREFIX = "remote:";
export const REMOTE_SHARE_TTL_HOURS = 24;

const DPASTE_CREATE_URL = "https://dpaste.com/api/v2/";
const MAX_REMOTE_CONTENT_CHARS = 750_000;
const REMOTE_ID_PATTERN = /^[A-Za-z0-9]{6,16}$/;

export type SharedDiff = {
  original: string;
  changed: string;
};

export type SharedDiffRef =
  | { kind: "inline"; diff: SharedDiff }
  | { kind: "remote"; id: string };

export function encodeSharedDiff({ original, changed }: SharedDiff) {
  return LZString.compressToEncodedURIComponent(
    JSON.stringify(sharedPayload({ original, changed })),
  );
}

export function encodeRemoteShare(id: string) {
  return `${REMOTE_SHARE_PREFIX}${id}`;
}

export function parseSharedDiffHash(hash: string): SharedDiffRef | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;

  const encoded = hash.slice(SHARE_HASH_PREFIX.length);
  if (!encoded) return null;

  if (encoded.startsWith(REMOTE_SHARE_PREFIX)) {
    const id = encoded.slice(REMOTE_SHARE_PREFIX.length);
    return isRemoteShareId(id) ? { kind: "remote", id } : null;
  }

  if (encoded.length > MAX_INLINE_HASH_LENGTH) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (!decompressed) return null;

    const diff = parseSharedPayload(decompressed);
    return diff ? { kind: "inline", diff } : null;
  } catch {
    return null;
  }
}

export function isSharedDiffHash(hash: string) {
  return hash.startsWith(SHARE_HASH_PREFIX);
}

export async function uploadSharedDiff(diff: SharedDiff) {
  const content = JSON.stringify(sharedPayload(diff));

  if (content.length > MAX_REMOTE_CONTENT_CHARS) {
    throw new Error(
      "This comparison is too large to share as a link. Open a PNG instead.",
    );
  }

  const body = new URLSearchParams({
    content,
    expiry_days: "1",
    syntax: "json",
    title: "davidasync-diff",
  });

  const response = await fetch(DPASTE_CREATE_URL, {
    method: "POST",
    headers: {
      Accept: "text/plain",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      "Unable to create a share link right now. Try again or open a PNG instead.",
    );
  }

  const location = (response.headers.get("Location") ?? (await response.text()))
    .trim()
    .replace(/\/$/, "");
  const id = location.split("/").pop()?.replace(/\.txt$/i, "") ?? "";

  if (!isRemoteShareId(id)) {
    throw new Error("Share service returned an unexpected response.");
  }

  return id;
}

const remoteDownloads = new Map<string, Promise<SharedDiff>>();

export function downloadSharedDiff(id: string) {
  const cached = remoteDownloads.get(id);
  if (cached) return cached;

  const pending = fetchSharedDiff(id).catch((error) => {
    remoteDownloads.delete(id);
    throw error;
  });

  remoteDownloads.set(id, pending);
  return pending;
}

async function fetchSharedDiff(id: string) {
  if (!isRemoteShareId(id)) {
    throw new Error("This share link is invalid.");
  }

  const response = await fetchRemoteText(id);

  if (response.status === 404) {
    throw new Error(
      "This share link is missing or expired (remote links last 24 hours).",
    );
  }

  if (!response.ok) {
    throw new Error("Unable to load this share link.");
  }

  const diff = parseSharedPayload(await response.text());
  if (!diff) {
    throw new Error("This share link does not contain a valid comparison.");
  }

  return diff;
}

async function fetchRemoteText(id: string) {
  const request = () =>
    fetch(`https://dpaste.com/${id}.txt`, {
      headers: { Accept: "text/plain" },
    });

  const first = await request();
  if (first.status !== 429) return first;

  await new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });
  return request();
}

function sharedPayload({ original, changed }: SharedDiff) {
  return { version: 1, original, changed };
}

function isRemoteShareId(id: string) {
  return REMOTE_ID_PATTERN.test(id);
}

function parseSharedPayload(value: string): SharedDiff | null {
  try {
    const payload: unknown = JSON.parse(value);

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("version" in payload) ||
      payload.version !== 1 ||
      !("original" in payload) ||
      typeof payload.original !== "string" ||
      !("changed" in payload) ||
      typeof payload.changed !== "string"
    ) {
      return null;
    }

    return {
      original: payload.original,
      changed: payload.changed,
    };
  } catch {
    return null;
  }
}
