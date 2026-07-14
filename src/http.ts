import { Cookie, CookieJar } from "tough-cookie";

import type { StorageCookie } from "./config";
import { ApiError } from "./errors";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class CookieHttpClient {
  readonly jar: CookieJar;

  constructor(jar = new CookieJar()) {
    this.jar = jar;
  }

  async request(url: string, init: RequestInit = {}, redirects = 10): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookie = await this.jar.getCookieString(url);
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(url, { ...init, headers, redirect: "manual" });
    await this.captureCookies(response, url);

    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirects <= 0) throw new ApiError("Too many authentication redirects.");
      const location = response.headers.get("location");
      if (!location) return response;
      const destination = new URL(location, url).toString();
      const switchToGet = response.status === 303 || ((response.status === 301 || response.status === 302) && init.method?.toUpperCase() === "POST");
      const next = switchToGet ? { method: "GET", headers: withoutBodyHeaders(headers) } : { ...init, headers };
      return this.request(destination, next, redirects - 1);
    }
    return response;
  }

  async get(url: string, init: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...init, method: "GET" });
  }

  async post(url: string, init: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...init, method: "POST" });
  }

  private async captureCookies(response: Response, url: string): Promise<void> {
    for (const value of getSetCookieHeaders(response.headers)) {
      await this.jar.setCookie(value, url, { ignoreError: true });
    }
  }

  async storageCookies(): Promise<StorageCookie[]> {
    const serialized = this.jar.serializeSync() as unknown as {
      cookies?: Array<Record<string, unknown>>;
    };
    return (serialized.cookies ?? []).flatMap((cookie) => {
      if (typeof cookie.key !== "string" || typeof cookie.value !== "string") return [];
      const expires = cookie.expires;
      return [{
        name: cookie.key,
        value: cookie.value,
        ...(typeof cookie.domain === "string" ? { domain: cookie.domain } : {}),
        path: typeof cookie.path === "string" ? cookie.path : "/",
        expires: expires && expires !== "Infinity" ? new Date(String(expires)).getTime() / 1000 : -1,
        httpOnly: cookie.httpOnly === true,
        secure: cookie.secure === true,
        sameSite: normalizeSameSite(cookie.sameSite),
      }];
    });
  }

  static fromStorage(cookies: StorageCookie[]): CookieHttpClient {
    const jar = new CookieJar();
    for (const stored of cookies) {
      const cookie = new Cookie({
        key: stored.name,
        value: stored.value,
        domain: stored.domain ?? null,
        path: stored.path,
        secure: stored.secure ?? false,
        httpOnly: stored.httpOnly ?? false,
        expires: stored.expires && stored.expires > 0 ? new Date(stored.expires * 1000) : "Infinity",
      });
      const scheme = stored.secure === false ? "http" : "https";
      const host = (stored.domain ?? "").replace(/^\./, "");
      if (host) jar.setCookieSync(cookie, `${scheme}://${host}${stored.path}`);
    }
    return new CookieHttpClient(jar);
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (extended.getSetCookie) return extended.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

function withoutBodyHeaders(headers: Headers): Headers {
  const result = new Headers(headers);
  result.delete("content-type");
  result.delete("content-length");
  return result;
}

function normalizeSameSite(value: unknown): string {
  const normalized = String(value ?? "lax").toLowerCase();
  return normalized === "strict" ? "Strict" : normalized === "none" ? "None" : "Lax";
}
