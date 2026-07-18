/** Erreur de base du client Leboncoin. */
export class LBCError extends Error {}

/** Valeur de filtre invalide. */
export class InvalidValueError extends LBCError {}

/** Échec HTTP non spécifique. */
export class RequestError extends LBCError {}

/** Requête bloquée par DataDome. */
export class DatadomeError extends RequestError {}

/** Annonce ou utilisateur introuvable. */
export class NotFoundError extends LBCError {}
