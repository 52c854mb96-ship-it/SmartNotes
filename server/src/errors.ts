import type { Usage } from './usage.js';

/** Feil som sendes til klienten med en norsk, brukervennlig melding. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Fant ikke det du lette etter.') => new HttpError(404, 'not_found', what);
export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);
export const offlineFeature = (message: string) => new HttpError(503, 'unavailable', message);

/**
 * Feil i konverteringen. `retryable` betyr at feilen trolig er midlertidig (nettverk, overbelastning),
 * og at notatet legges tilbake i køen automatisk.
 */
export class ConversionError extends Error {
  /** Forbruket når modellen svarte, men svaret ikke kunne brukes (for forbruksloggen). */
  usage?: Usage;

  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/**
 * AI-kallet ble avbrutt av serveren selv: den stenger, eller notatet ble slettet. Ingenting skal lagres; et avbrutt
 * notat konverteres på nytt fra køen etter omstart.
 */
export class AbortedError extends ConversionError {
  constructor(message: string) {
    super(message, true);
  }
}
