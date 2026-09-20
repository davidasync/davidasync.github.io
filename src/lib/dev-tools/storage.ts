export const DEV_TOOLS_STORAGE_VERSION = 1;

export type TextToolId = "base64" | "escape" | "json" | "xml" | "yaml";
export type StoredToolId = TextToolId | "diff" | "jwt" | "objects" | "shorten";

export type StoredTextSpec = {
  v: typeof DEV_TOOLS_STORAGE_VERSION;
  input: string;
  output: string;
};

export type StoredDiffSpec = {
  v: typeof DEV_TOOLS_STORAGE_VERSION;
  original: string;
  changed: string;
};

export type StoredJwtSpec = {
  v: typeof DEV_TOOLS_STORAGE_VERSION;
  mode: "decode" | "encode";
  token: string;
  headerText: string;
  payloadText: string;
  secret: string;
  secretIsBase64Url: boolean;
  algorithm: string;
};

export type StoredShortLink = {
  code: string;
  shortUrl: string;
  url: string;
  expireAt: string;
  createdAt: string;
};

export type StoredShortenSpec = {
  v: typeof DEV_TOOLS_STORAGE_VERSION;
  url: string;
  code: string;
  ttlSeconds: number;
  /** Newest first, capped at MAX_STORED_LINKS. */
  links: StoredShortLink[];
};

export type StoredUploadedObject = {
  id: string;
  url: string;
  /** The name it was uploaded under, or "" when the bytes were pasted unnamed. */
  filename: string;
  contentType: string;
  size: number;
  expireAt: string;
  createdAt: string;
};

export type StoredObjectsSpec = {
  v: typeof DEV_TOOLS_STORAGE_VERSION;
  text: string;
  filename: string;
  ttlSeconds: number;
  /** Newest first, capped at MAX_STORED_LINKS. */
  objects: StoredUploadedObject[];
};

/** Enough to find a link made earlier today without letting the entry grow unbounded. */
export const MAX_STORED_LINKS = 20;

const PREFIX = "davidasync.dev-tools.";

export function readTextSpec(id: TextToolId) {
  return readSpec(id, isTextSpec);
}

export function writeTextSpec(
  id: TextToolId,
  spec: Omit<StoredTextSpec, "v">,
) {
  writeSpec(id, { v: DEV_TOOLS_STORAGE_VERSION, ...spec });
}

export function readDiffSpec() {
  return readSpec("diff", isDiffSpec);
}

export function writeDiffSpec(spec: Omit<StoredDiffSpec, "v">) {
  writeSpec("diff", { v: DEV_TOOLS_STORAGE_VERSION, ...spec });
}

export function readJwtSpec() {
  return readSpec("jwt", isJwtSpec);
}

export function writeJwtSpec(spec: Omit<StoredJwtSpec, "v">) {
  writeSpec("jwt", { v: DEV_TOOLS_STORAGE_VERSION, ...spec });
}

export function readShortenSpec() {
  return readSpec("shorten", isShortenSpec);
}

export function writeShortenSpec(spec: Omit<StoredShortenSpec, "v">) {
  writeSpec("shorten", {
    v: DEV_TOOLS_STORAGE_VERSION,
    ...spec,
    links: spec.links.slice(0, MAX_STORED_LINKS),
  });
}

export function readObjectsSpec() {
  return readSpec("objects", isObjectsSpec);
}

export function writeObjectsSpec(spec: Omit<StoredObjectsSpec, "v">) {
  writeSpec("objects", {
    v: DEV_TOOLS_STORAGE_VERSION,
    ...spec,
    objects: spec.objects.slice(0, MAX_STORED_LINKS),
  });
}

export function clearToolSpec(id: StoredToolId) {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // Private mode or a blocked storage API.
  }
}

function readSpec<T>(id: StoredToolId, isValid: (value: unknown) => value is T) {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSpec(id: StoredToolId, value: unknown) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Quota or a blocked storage API.
  }
}

function storageKey(id: StoredToolId) {
  return `${PREFIX}${id}`;
}

function isTextSpec(value: unknown): value is StoredTextSpec {
  return (
    isVersioned(value) &&
    typeof value.input === "string" &&
    typeof value.output === "string"
  );
}

function isDiffSpec(value: unknown): value is StoredDiffSpec {
  return (
    isVersioned(value) &&
    typeof value.original === "string" &&
    typeof value.changed === "string"
  );
}

function isJwtSpec(value: unknown): value is StoredJwtSpec {
  return (
    isVersioned(value) &&
    (value.mode === "decode" || value.mode === "encode") &&
    typeof value.token === "string" &&
    typeof value.headerText === "string" &&
    typeof value.payloadText === "string" &&
    typeof value.secret === "string" &&
    typeof value.secretIsBase64Url === "boolean" &&
    typeof value.algorithm === "string"
  );
}

function isShortenSpec(value: unknown): value is StoredShortenSpec {
  return (
    isVersioned(value) &&
    typeof value.url === "string" &&
    typeof value.code === "string" &&
    typeof value.ttlSeconds === "number" &&
    Array.isArray(value.links) &&
    value.links.every(isShortLink)
  );
}

function isObjectsSpec(value: unknown): value is StoredObjectsSpec {
  return (
    isVersioned(value) &&
    typeof value.text === "string" &&
    typeof value.filename === "string" &&
    typeof value.ttlSeconds === "number" &&
    Array.isArray(value.objects) &&
    value.objects.every(isUploadedObject)
  );
}

function isUploadedObject(value: unknown): value is StoredUploadedObject {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "url" in value &&
    typeof value.url === "string" &&
    "filename" in value &&
    typeof value.filename === "string" &&
    "contentType" in value &&
    typeof value.contentType === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "expireAt" in value &&
    typeof value.expireAt === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function isShortLink(value: unknown): value is StoredShortLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "shortUrl" in value &&
    typeof value.shortUrl === "string" &&
    "url" in value &&
    typeof value.url === "string" &&
    "expireAt" in value &&
    typeof value.expireAt === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function isVersioned(
  value: unknown,
): value is Record<string, unknown> & { v: typeof DEV_TOOLS_STORAGE_VERSION } {
  return (
    typeof value === "object" &&
    value !== null &&
    "v" in value &&
    value.v === DEV_TOOLS_STORAGE_VERSION
  );
}
