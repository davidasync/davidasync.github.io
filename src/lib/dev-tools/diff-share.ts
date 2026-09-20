import LZString from "lz-string";
import {
  MAX_OBJECT_BYTES,
  MAX_TTL_SECONDS,
  OBJECT_STORAGE_BASE_URL,
  formatBytes,
  getObject,
  isObjectId,
  putObject,
} from "./object-storage";

export const MAX_SHARE_URL_LENGTH = 2_000;
const MAX_INLINE_HASH_LENGTH = 100_000;
export const SHARE_HASH_PREFIX = "#diff=";
export const REMOTE_SHARE_PREFIX = "remote:";
export const REMOTE_SHARE_TTL_DAYS = MAX_TTL_SECONDS / (24 * 60 * 60);

/** The host only — the scheme is noise in a status line. */
export const REMOTE_SHARE_HOST = OBJECT_STORAGE_BASE_URL.replace(
  /^https?:\/\//,
  "",
);

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
    return isObjectId(id) ? { kind: "remote", id } : null;
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
  // Weighed in bytes rather than characters, because the store's cap is a byte
  // cap and a comparison full of multi-byte text is where the two diverge.
  const content = new TextEncoder().encode(
    JSON.stringify(sharedPayload(diff)),
  );

  if (content.byteLength > MAX_OBJECT_BYTES) {
    throw new Error(
      `This comparison is larger than the ${formatBytes(MAX_OBJECT_BYTES)} share limit. Open a PNG instead.`,
    );
  }

  const stored = await putObject({
    body: content,
    contentType: "application/json",
    filename: "diff.json",
    ttlSeconds: MAX_TTL_SECONDS,
  });

  if (!isObjectId(stored.id)) {
    throw new Error("Share service returned an unexpected response.");
  }

  return stored.id;
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
  if (!isObjectId(id)) {
    throw new Error("This share link is invalid.");
  }

  const response = await getObject(id);

  if (response.status === 404) {
    throw new Error(
      `This share link is missing or expired (remote links last ${REMOTE_SHARE_TTL_DAYS} days).`,
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

function sharedPayload({ original, changed }: SharedDiff) {
  return { version: 1, original, changed };
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
