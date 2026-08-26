function bytesToBinary(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return binary;
}

export function encodeBase64(value: string) {
  return btoa(bytesToBinary(new TextEncoder().encode(value)));
}

export function decodeBase64(value: string) {
  const compact = value.replace(/\s/g, "");

  if (compact === "") return "";

  if (
    compact.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact,
    )
  ) {
    throw new Error("Input is not valid Base64.");
  }

  try {
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Base64 input does not contain valid UTF-8 text.");
  }
}
