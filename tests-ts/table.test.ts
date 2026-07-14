import { describe, expect, test } from "bun:test";
import stringWidth from "string-width";

import { renderTable } from "../src/table";

describe("terminal table", () => {
  test("aligns Chinese text, ellipsis, negative numbers, and wide values", () => {
    const output = renderTable(
      ["GROUP", "AVAILABLE", "TOTAL"],
      [
        ["训练区-H200-很长的机房名称", "0", "24"],
        ["开发区-H100", "-55", "2276"],
      ],
      { maxWidths: [18, 9, 5], align: ["left", "right", "right"] },
    );
    const widths = output.split("\n").map((line) => stringWidth(line));
    expect(new Set(widths).size).toBe(1);
    expect(output).toContain("…");
    expect(output).toContain("      -55");
  });

  test("wide mode preserves complete copyable values", () => {
    const value = "训练区-H200-3号机房-2-cuda12.8版本";
    expect(renderTable(["GROUP"], [[value]], { maxWidths: [8], wide: true })).toContain(value);
  });
});
