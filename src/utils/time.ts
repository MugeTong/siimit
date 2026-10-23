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

export function parseDuration(duration: string): number {
    const factorMap = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
    } as const;
    type TimeUnit = keyof typeof factorMap;

    const regex = /^(\d+(?:\.\d+)?)([smhd])$/;
    const match = duration.match(regex);
    if (!match || !match[1] || !match[2]) {
        throw new Error("Invalid duration format. Use a number followed by 's', 'm', 'h', or 'd'.");
    }

    const timeUnit = match[2] as TimeUnit;
    const time = Number(match[1]);

    return time * factorMap[timeUnit];
}

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
