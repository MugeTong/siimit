import * as cheerio from "cheerio";

import { type BrowserSession, DEFAULT_BASE_URL } from "./config";
import { AuthenticationError } from "./errors";
import { CookieHttpClient } from "./http";

const USER_DETAIL_PATH = "/api/v1/user/detail";
const CAS_PROVIDER_LOGIN_RE = /"loginUrl"\s*:\s*"([^"]*broker[^"]*cas[^"]*login[^"]*)"/;
const CAS_RSA_KEY_RE = /RSAUtils\.getKeyPair\(\s*['"]([0-9a-fA-F]+)['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"]([0-9a-fA-F]+)['"]/;

export interface LoginOptions {
  username: string;
  password: string;
  baseUrl?: string;
  client?: CookieHttpClient;
}

export async function loginHttp(options: LoginOptions): Promise<BrowserSession> {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const client = options.client ?? new CookieHttpClient();
  const pageHeaders = {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) siimit/0.2",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  let response = await client.get(`${baseUrl}/login`, { headers: pageHeaders });
  ensureSuccess(response, "opening login page");
  let html = await response.text();
  const providerUrl = decodeProviderUrl(html, response.url);
  if (providerUrl) {
    response = await client.get(providerUrl, { headers: pageHeaders });
    ensureSuccess(response, "opening CAS provider");
    html = await response.text();
  }

  const { action, fields } = extractLoginForm(html, response.url);
  const [exponent, modulus] = await resolveRsaKey(client, html, response.url);
  fields.set("username", options.username);
  fields.set("password", encryptCasPassword(options.password, exponent, modulus));
  if (!fields.get("encrypted")) fields.set("encrypted", "true");
  if (!fields.get("_eventId")) fields.set("_eventId", "submit");
  if (!fields.get("loginType")) fields.set("loginType", "1");

  const authResponse = await client.post(action, {
    headers: { ...pageHeaders, "content-type": "application/x-www-form-urlencoded", referer: response.url },
    body: fields.toString(),
  });
  ensureSuccess(authResponse, "submitting CAS credentials");

  const identityResponse = await client.get(`${baseUrl}${USER_DETAIL_PATH}`, {
    headers: { accept: "application/json", referer: `${baseUrl}/login` },
  });
  if (identityResponse.status !== 200) {
    throw new AuthenticationError(`HTTP login did not complete (identity check returned HTTP ${identityResponse.status}).`);
  }
  const identity = await parseJsonRecord(identityResponse, "identity");
  const userDetail = isRecord(identity.data) ? identity.data : identity;
  const cookies = await client.storageCookies();
  if (!cookies.length) throw new AuthenticationError("HTTP login returned no session cookie.");

  return {
    base_url: baseUrl,
    username: options.username,
    created_at: Date.now() / 1000,
    storage_state: { cookies, origins: [] },
    user_detail: userDetail,
  };
}

export function extractLoginForm(html: string, pageUrl: string): { action: string; fields: URLSearchParams } {
  const $ = cheerio.load(html);
  let selected = $("form#fm1").first();
  if (!selected.length) {
    selected = $("form").filter((_, form) => $(form).find("[name=username]").length > 0 && $(form).find("[name=password]").length > 0).first();
  }
  if (!selected.length) throw new AuthenticationError("CAS login form was not found.");
  const fields = new URLSearchParams();
  selected.find("input[name]").each((_, input) => fields.set($(input).attr("name")!, $(input).attr("value") ?? ""));
  return { action: new URL(selected.attr("action") || pageUrl, pageUrl).toString(), fields };
}

export function encryptCasPassword(password: string, exponentHex: string, modulusHex: string): string {
  const modulusDigits = Math.ceil((modulusHex.replace(/^0+/, "") || "0").length / 4);
  const chunkSize = 2 * (modulusDigits - 1);
  if (chunkSize <= 0) throw new AuthenticationError("CAS returned an invalid RSA key.");
  const values = Array.from(password, (character) => character.charCodeAt(0));
  while (values.length % chunkSize) values.push(0);
  const exponent = BigInt(`0x${exponentHex}`);
  const modulus = BigInt(`0x${modulusHex}`);
  const encrypted: string[] = [];
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    let block = 0n;
    for (let index = 0; index < chunkSize; index++) block += BigInt(values[offset + index] ?? 0) << BigInt(8 * index);
    let text = modPow(block, exponent, modulus).toString(16);
    while (text.length % 4) text = `0${text}`;
    encrypted.push(text);
  }
  return encrypted.join(" ");
}

async function resolveRsaKey(client: CookieHttpClient, html: string, pageUrl: string): Promise<[string, string]> {
  const inline = CAS_RSA_KEY_RE.exec(html);
  if (inline?.[1] && inline[2]) return [inline[1], inline[2]];
  const $ = cheerio.load(html);
  for (const element of $("script[src]").toArray()) {
    const scriptUrl = new URL($(element).attr("src")!, pageUrl);
    if (scriptUrl.host !== new URL(pageUrl).host) continue;
    const response = await client.get(scriptUrl.toString());
    if (!response.ok) continue;
    const match = CAS_RSA_KEY_RE.exec(await response.text());
    if (match?.[1] && match[2]) return [match[1], match[2]];
  }
  throw new AuthenticationError("CAS RSA public key was not found.");
}

function decodeProviderUrl(html: string, pageUrl: string): string | undefined {
  const match = CAS_PROVIDER_LOGIN_RE.exec(html);
  if (!match?.[1]) return undefined;
  let decoded = match[1].replaceAll("\\/", "/");
  try { decoded = JSON.parse(`"${match[1]}"`) as string; } catch {}
  return new URL(decoded, pageUrl).toString();
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let current = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = (result * current) % modulus;
    power >>= 1n;
    current = (current * current) % modulus;
  }
  return result;
}

function ensureSuccess(response: Response, context: string): void {
  if (!response.ok) throw new AuthenticationError(`HTTP ${response.status} while ${context}.`);
}

async function parseJsonRecord(response: Response, label: string): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    if (isRecord(value)) return value;
  } catch {}
  throw new AuthenticationError(`Inspire returned invalid ${label} JSON.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

