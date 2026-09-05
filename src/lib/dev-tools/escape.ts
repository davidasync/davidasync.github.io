export function escapeText(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

export function unescapeText(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  try {
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    }

    const parsed: unknown = JSON.parse(`"${trimmed}"`);
    if (typeof parsed === "string") return parsed;
  } catch {
    // Fall through to a clearer error.
  }

  throw new Error("Input is not valid escaped text.");
}
