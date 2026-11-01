# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet suit [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- Workflow GitHub Actions : `bun install --frozen-lockfile`, `bun run check`
  (`tsc --noEmit` + Biome) et `bun test`.

## [0.1.1] - 2026-07-18

### Added

- Champs de vendeur supplémentaires dans les modèles : notes détaillées
  (`overallScore`, `cleanness`, `communication`, `conformity`, `package`,
  `product`, `recommendation`, `respect`, `transaction`, `userAttention`),
  délai de réponse, dernière activité et adresse (ville, quartier, code postal,
  coordonnées).
- Configuration Biome (`biome.json`) et scripts `check`, `fix`, `format` et
  `lint`.
- Couverture de tests étendue sur les modèles et la recherche.

### Changed

- L'option `proxy` du client prend le type `LbcProxy`.
- `search()` envoie `limit_alu`, `offset`, `disable_total` et `extend` avec les
  filtres typés.

### Fixed

- Typage des énumérations, des modèles et des options de recherche aligné sur
  les charges utiles de l'API.

## [0.1.0] - 2026-07-18

### Added

- Publication initiale sur npm : `Client` avec `search`, `getAd` et `getUser`,
  modèles et énumérations typés, helpers géographiques et classes d'erreur
  (`LBCError`, `InvalidValueError`, `RequestError`, `DatadomeError`,
  `NotFoundError`).
- Empreinte TLS/HTTP de `curl-impersonate`, persistance des cookies et gestion du
  blocage DataDome via `curl-cffi-node`.

[Unreleased]: https://github.com/Phanty78/lbc-ts/compare/v0.1.1...master
[0.1.1]: https://github.com/Phanty78/lbc-ts/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/@maeldonnart/lbc-ts/v/0.1.0
