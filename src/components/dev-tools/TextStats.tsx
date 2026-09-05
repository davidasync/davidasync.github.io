export function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${formatCount(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function measureText(value: string) {
  const bytes = new TextEncoder().encode(value).byteLength;
  const chars = [...value].length;
  const lines = value === "" ? 0 : value.split(/\r\n|\r|\n/).length;
  return { bytes, chars, lines };
}

export default function TextStats({ value }: { value: string }) {
  if (!value) return null;

  const stats = measureText(value);

  return (
    <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
      {formatSize(stats.bytes)}
      <span className="mx-2 text-border">·</span>
      {formatCount(stats.chars)} chars
      <span className="mx-2 text-border">·</span>
      {formatCount(stats.lines)} {stats.lines === 1 ? "line" : "lines"}
    </p>
  );
}
