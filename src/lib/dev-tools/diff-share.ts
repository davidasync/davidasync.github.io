import LZString from "lz-string";

export const MAX_SHARE_URL_LENGTH = 20_000;

export type SharedDiff = {
  original: string;
  changed: string;
};

export function encodeSharedDiff({ original, changed }: SharedDiff) {
  return LZString.compressToEncodedURIComponent(
    JSON.stringify({ version: 1, original, changed }),
  );
}

export function decodeSharedDiffHash(hash: string): SharedDiff | null {
  const prefix = "#diff=";
  if (!hash.startsWith(prefix)) return null;

  const encoded = hash.slice(prefix.length);
  if (!encoded || encoded.length > MAX_SHARE_URL_LENGTH) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (!decompressed) return null;

    const payload: unknown = JSON.parse(decompressed);

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
