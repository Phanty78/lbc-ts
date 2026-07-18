import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { Session } from "curl-cffi-node";
import { DatadomeError, NotFoundError, RequestError } from "./errors.js";
import { Proxy as LbcProxy } from "./geo.js";
import { Ad, type Raw, Search, User } from "./models.js";
import { buildSearchPayload, buildSearchPayloadFromUrl, type SearchOptions } from "./search.js";

const HOME_URL = "https://www.leboncoin.fr/";
const SEARCH_URL = "https://api.leboncoin.fr/finder/search";

export interface ClientOptions {
  proxy?: LbcProxy;
  /** Profil de `curl-impersonate`, par exemple `safari170` ou `chrome131`. */
  impersonate?: string;
  requestVerify?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/** Client asynchrone de l’API non officielle Leboncoin. */
export class Client {
  #proxy?: LbcProxy;
  #session!: Session;
  #ready!: Promise<void>;
  readonly impersonate: string;
  readonly requestVerify: boolean;
  readonly timeout: number;
  readonly maxRetries: number;

  constructor({
    proxy,
    impersonate = "safari170",
    requestVerify = true,
    timeout = 30,
    maxRetries = 5,
  }: ClientOptions = {}) {
    if (proxy && !(proxy instanceof LbcProxy)) throw new TypeError("Proxy must be an instance of Proxy.");
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError("Timeout must be greater than zero.");
    if (!Number.isInteger(maxRetries) || maxRetries < 0)
      throw new RangeError("Max retries must be a non-negative integer.");
    this.impersonate = impersonate;
    this.requestVerify = requestVerify;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.#proxy = proxy;
    this.#reset();
  }

  get proxy(): LbcProxy | undefined {
    return this.#proxy;
  }
  set proxy(value: LbcProxy | undefined) {
    if (value && !(value instanceof LbcProxy)) throw new TypeError("Proxy must be an instance of Proxy.");
    this.#proxy = value;
    this.#reset();
  }

  async search(options: SearchOptions = {}): Promise<Search> {
    const payload = options.url
      ? buildSearchPayloadFromUrl(
          options.url,
          options.limit as number | undefined,
          options.limitAlu as number | undefined,
          options.page as number | undefined,
        )
      : buildSearchPayload(options);
    return new Search(await this.#fetch("POST", SEARCH_URL, payload), this);
  }

  async getAd(adId: string | number): Promise<Ad> {
    return new Ad(await this.#fetch("GET", `https://api.leboncoin.fr/api/adfinder/v1/classified/${adId}`), this);
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.#fetch("GET", `https://api.leboncoin.fr/api/user-card/v2/${userId}/infos`);
    let pro: Raw | undefined;
    if (user.account_type === "pro") {
      try {
        pro = await this.#fetch("GET", `https://api.leboncoin.fr/api/onlinestores/v2/users/${userId}?fields=all`);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    return new User(user, pro);
  }

  #reset(): void {
    this.#session = new Session({
      impersonate: this.impersonate,
      proxy: this.#proxy?.url,
      timeout: this.timeout,
      verify: this.requestVerify,
      headers: {
        "User-Agent": userAgent(),
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      },
    });
    this.#ready = this.#session.get(HOME_URL).then(() => undefined);
  }

  async #fetch(
    method: "GET" | "POST",
    url: string,
    payload?: Record<string, unknown>,
    retries = this.maxRetries,
  ): Promise<Raw> {
    await this.#ready;
    const response =
      method === "POST" ? await this.#session.post(url, { data: payload }) : await this.#session.get(url);
    if (response.status >= 200 && response.status < 300) return readJson(response);
    if (response.status === 403 && retries > 0) {
      this.#reset();
      return this.#fetch(method, url, payload, retries - 1);
    }
    if (response.status === 403)
      throw new DatadomeError(
        this.#proxy
          ? "Access blocked by Datadome: your proxy appears to have a poor reputation."
          : "Access blocked by Datadome: your activity was flagged as suspicious.",
      );
    if (response.status === 404 || response.status === 410) throw new NotFoundError("Unable to find ad or user.");
    throw new RequestError(`Request failed with status code ${response.status}.`);
  }
}

function userAgent(): string {
  return "LBC;iOS;26.2;iPhone;phone;01234567-89AB-CDEF-0123-456789ABCDEF;wifi;101.44.0";
}

function readJson(response: { buffer(): Buffer; headers: { get(name: string): string | null } }): Raw {
  const body = response.buffer();
  const encoding = response.headers.get("content-encoding");
  const decoded =
    encoding === "gzip"
      ? gunzipSync(body)
      : encoding === "deflate"
        ? inflateSync(body)
        : encoding === "br"
          ? brotliDecompressSync(body)
          : body;
  return JSON.parse(decoded.toString()) as Raw;
}
