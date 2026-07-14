import stringWidth from "string-width";

export type Alignment = "left" | "right";

export function renderTable(
  headers: string[],
  rows: string[][],
  options: { maxWidths?: number[]; align?: Alignment[]; wide?: boolean } = {},
): string {
  const widths = headers.map((header, index) => Math.min(
    options.wide ? Number.POSITIVE_INFINITY : options.maxWidths?.[index] ?? 32,
    Math.max(stringWidth(header), ...rows.map((row) => stringWidth(row[index] ?? ""))),
  ));
  const line = (columns: string[]) => columns
    .map((value, index) => pad(
      truncate(value, widths[index]!),
      widths[index]!,
      options.align?.[index] ?? "left",
    ))
    .join("  ")
    .trimEnd();
  return [
    line(headers),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ].join("\n");
}

function truncate(value: string, width: number): string {
  if (stringWidth(value) <= width) return value;
  const ellipsis = "…";
  let result = "";
  for (const character of value) {
    if (stringWidth(result + character + ellipsis) > width) break;
    result += character;
  }
  return result + ellipsis;
}

function pad(value: string, width: number, alignment: Alignment): string {
  const spaces = " ".repeat(Math.max(0, width - stringWidth(value)));
  return alignment === "right" ? spaces + value : value + spaces;
}
