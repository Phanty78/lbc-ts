import { Impit, type Browser } from "impit";
import { DatadomeError, NotFoundError, RequestError } from "./errors.js";
import { Proxy } from "./geo.js";
import { Ad, type Raw, Search, User } from "./models.js";
import { buildSearchPayload, buildSearchPayloadFromUrl, type SearchOptions } from "./search.js";

const HOME_URL = "https://www.leboncoin.fr/";
const SEARCH_URL = "https://api.leboncoin.fr/finder/search";

export interface ClientOptions {
  proxy?: Proxy;
  browser?: Browser;
  requestVerify?: boolean;
  timeout?: number;
  maxRetries?: number;
}

type Cookie = { value: string; domain: string; path: string; expires?: number; secure: boolean };

class CookieJar {
  #cookies = new Map<string, Cookie>();

  setCookie(header: string, url: string): void {
    const [nameValue, ...attributes] = header.split(";").map((value) => value.trim());
    const separator = nameValue?.indexOf("=") ?? -1;
    if (separator < 1) return;
    const target = new URL(url);
    const name = nameValue!.slice(0, separator);
    const cookie: Cookie = { value: nameValue!.slice(separator + 1), domain: target.hostname, path: "/", secure: target.protocol === "https:" };
    for (const attribute of attributes) {
      const [key, value] = attribute.split("=", 2);
      if (!key) continue;
      if (key.toLowerCase() === "domain" && value) cookie.domain = value.replace(/^\./, "").toLowerCase();
      if (key.toLowerCase() === "path" && value) cookie.path = value;
      if (key.toLowerCase() === "expires" && value) cookie.expires = Date.parse(value);
      if (key.toLowerCase() === "max-age" && value) cookie.expires = Date.now() + Number(value) * 1000;
      if (key.toLowerCase() === "secure") cookie.secure = true;
    }
    this.#cookies.set(`${cookie.domain}:${cookie.path}:${name}`, cookie);
  }

  getCookieString(url: string): string {
    const target = new URL(url);
    const now = Date.now();
    return [...this.#cookies.entries()].flatMap(([key, cookie]) => {
      if (cookie.expires && cookie.expires <= now) { this.#cookies.delete(key); return []; }
      if (!(target.hostname === cookie.domain || target.hostname.endsWith(`.${cookie.domain}`)) || !target.pathname.startsWith(cookie.path) || (cookie.secure && target.protocol !== "https:")) return [];
      return [key.slice(key.lastIndexOf(":") + 1) + "=" + cookie.value];
    }).join("; ");
  }
}

/** Client asynchrone de l’API non officielle Leboncoin. */
export class Client {
  #proxy?: Proxy;
  #transport!: Impit;
  #ready!: Promise<void>;
  readonly browser: Browser;
  readonly requestVerify: boolean;
  readonly timeout: number;
  readonly maxRetries: number;

  constructor({ proxy, browser = "chrome", requestVerify = true, timeout = 30, maxRetries = 5 }: ClientOptions = {}) {
    if (proxy && !(proxy instanceof Proxy)) throw new TypeError("Proxy must be an instance of Proxy.");
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError("Timeout must be greater than zero.");
    if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new RangeError("Max retries must be a non-negative integer.");
    this.browser = browser;
    this.requestVerify = requestVerify;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.#proxy = proxy;
    this.#reset();
  }

  get proxy(): Proxy | undefined { return this.#proxy; }
  set proxy(value: Proxy | undefined) {
    if (value && !(value instanceof Proxy)) throw new TypeError("Proxy must be an instance of Proxy.");
    this.#proxy = value;
    this.#reset();
  }

  async search(options: SearchOptions = {}): Promise<Search> {
    const payload = options.url ? buildSearchPayloadFromUrl(options.url, options.limit as number | undefined, options.limitAlu as number | undefined, options.page as number | undefined) : buildSearchPayload(options);
    return new Search(await this.#fetch("POST", SEARCH_URL, payload), this);
  }

  async getAd(adId: string | number): Promise<Ad> {
    return new Ad(await this.#fetch("GET", `https://api.leboncoin.fr/api/adfinder/v1/classified/${adId}`), this);
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.#fetch("GET", `https://api.leboncoin.fr/api/user-card/v2/${userId}/infos`);
    let pro: Raw | undefined;
    if (user.account_type === "pro") {
      try { pro = await this.#fetch("GET", `https://api.leboncoin.fr/api/onlinestores/v2/users/${userId}?fields=all`); }
      catch (error) { if (!(error instanceof NotFoundError)) throw error; }
    }
    return new User(user, pro);
  }

  #reset(): void {
    const cookieJar = new CookieJar();
    this.#transport = new Impit({ browser: this.browser, proxyUrl: this.#proxy?.url, timeout: this.timeout * 1000, ignoreTlsErrors: !this.requestVerify, cookieJar, headers: { "User-Agent": userAgent(), "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-site" } });
    this.#ready = this.#transport.fetch(HOME_URL).then(() => undefined);
  }

  async #fetch(method: "GET" | "POST", url: string, payload?: Record<string, unknown>, retries = this.maxRetries): Promise<Raw> {
    await this.#ready;
    const response = await this.#transport.fetch(url, payload ? { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } } : { method });
    if (response.ok) return await response.json() as Raw;
    if (response.status === 403 && retries > 0) { this.#reset(); return this.#fetch(method, url, payload, retries - 1); }
    if (response.status === 403) throw new DatadomeError(this.#proxy ? "Access blocked by Datadome: your proxy appears to have a poor reputation." : "Access blocked by Datadome: your activity was flagged as suspicious.");
    if (response.status === 404 || response.status === 410) throw new NotFoundError("Unable to find ad or user.");
    throw new RequestError(`Request failed with status code ${response.status}.`);
  }
}

function userAgent(): string {
  const ios = Math.random() < 0.5;
  const id = ios ? crypto.randomUUID() : crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  if (ios) return `LBC;iOS;${pick(["18.5", "18.7.3", "26.2"])};iPhone;phone;${id};wifi;${pick(["101.45.0", "101.44.0", "101.43.1"])}`;
  return `LBC;Android;${pick(["11", "12", "13", "14", "15"])};${pick(["SM-G991B", "Pixel 8", "ONEPLUS A6003"])};phone;${id};wifi;${pick(["100.85.2", "100.84.1", "100.83.1"])}`;
}

function pick<T>(values: readonly T[]): T { return values[Math.floor(Math.random() * values.length)]!; }
