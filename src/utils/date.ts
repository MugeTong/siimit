export function timestamp2date(timestamp: number): string {
    return new Date(timestamp).toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
    });
}
