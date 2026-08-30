export const DEV_TOOLS_STORAGE_VERSION = 1;

export type TextToolId = "base64" | "json" | "xml" | "yaml";
export type StoredToolId = TextToolId | "diff" | "jwt";

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
