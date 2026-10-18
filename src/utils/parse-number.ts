export function parseInteger(value: string): number | undefined {
  if (!/^-?\d+$/.test(value)) {
    return undefined;
  }
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : undefined;
}

export function parseNumber(value: string): number | undefined {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}
