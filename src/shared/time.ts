export interface NormalizedTime {
  readonly iso: string;
  readonly milliseconds: number | null;
}

export function normalizeTime(value: unknown): NormalizedTime {
  const text = String(value ?? "").trim();
  if (!text) return { iso: "", milliseconds: null };
  const numeric = Number(text);
  const milliseconds = Number.isFinite(numeric)
    ? (Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric)
    : Date.parse(text);
  if (!Number.isFinite(milliseconds)) return { iso: text, milliseconds: null };
  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

export function displayTime(iso: string): string {
  return iso.replace("T", " ").replace(/\.000Z$/, "").replace(/Z$/, "");
}
