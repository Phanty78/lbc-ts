# lbc-ts

[![npm](https://img.shields.io/npm/v/@maeldonnart/lbc-ts.svg)](https://www.npmjs.com/package/@maeldonnart/lbc-ts)
[![CI](https://github.com/Phanty78/lbc-ts/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Phanty78/lbc-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Client TypeScript/Bun non officiel pour l’API Leboncoin, issu du portage de [etienne-hd/lbc](https://github.com/etienne-hd/lbc).

```ts
import { AdType, Category, City, Client, Sort } from "@maeldonnart/lbc-ts";

const client = new Client();
const result = await client.search({
  text: "maison",
  locations: new City(48.8599, 2.3380, 10_000, "Paris"),
  sort: Sort.NEWEST,
  adType: AdType.OFFER,
  category: Category.IMMOBILIER,
  square: [200, 400],
  price: [300_000, 700_000],
});

for (const ad of result.ads) console.log(ad.url, ad.subject, ad.price);
```

## Installation

```sh
bun add @maeldonnart/lbc-ts
```

## API

`Client` expose trois méthodes asynchrones :

- `search(options)` accepte les options typées et les filtres API (`price`, `square`, `real_estate_type`, etc.), ou une URL de recherche via `url`.
- `getAd(adId)` récupère une annonce complète.
- `getUser(userId)` récupère un vendeur ; `await ad.user` le charge paresseusement.

`Client` accepte `proxy`, `impersonate` (par défaut `"safari170"`), `requestVerify`, `timeout` en secondes et `maxRetries`. La dépendance `curl-cffi-node` assure l’empreinte TLS/HTTP de `curl-impersonate` et la persistance des cookies.

## Erreurs 403

`DatadomeError` signale un blocage côté Leboncoin. Réduis la fréquence des requêtes et utilise, si nécessaire, un proxy fiable ; l’empreinte navigateur ne garantit pas l’accès à elle seule.

> La CI s’exécute sur macOS : le binaire natif de `curl-cffi-node` ne se charge
> pas sur les runners Linux (symbole `libidn2` non résolu).

Ce projet n’est pas affilié à Leboncoin. Utilise-le de manière responsable et conforme à leurs conditions d’utilisation.

## ☕ Soutenir le projet

Si ce projet vous est utile, vous pouvez soutenir son développement :

[![Buy Me a Coffee](https://img.shields.io/badge/Offrez--moi%20un%20café-devphanty-yellow?logo=buymeacoffee)](https://buymeacoffee.com/devphanty)
