export class City {
  constructor(
    public readonly lat: number,
    public readonly lng: number,
    public readonly radius = 10_000,
    public readonly city?: string,
  ) {}
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: Nom conservé pour compatibilité avec l’API publique.
export class Proxy {
  constructor(
    public readonly host: string,
    public readonly port: string | number,
    public readonly username?: string,
    public readonly password?: string,
    public readonly scheme = "http",
  ) {}

  get url(): string {
    const credentials =
      this.username && this.password
        ? `${encodeURIComponent(this.username)}:${encodeURIComponent(this.password)}@`
        : "";
    return `${this.scheme}://${credentials}${this.host}:${this.port}`;
  }
}
