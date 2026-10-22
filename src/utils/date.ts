export function timestamp2date(timestamp: number, show_ms?: boolean): string {
    return new Date(timestamp).toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: show_ms ? 3 : undefined,
    });
}
