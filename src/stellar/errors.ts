/**
 * Typed errors for Soroban resolution transaction flows.
 * Messages must never include the agent secret key.
 */

export type SorobanErrorKind = 'simulation' | 'submission' | 'timeout' | 'config';

export abstract class SorobanError extends Error {
  abstract readonly kind: SorobanErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Contract simulation failed; transaction was not submitted. */
export class SorobanSimulationError extends SorobanError {
  readonly kind = 'simulation' as const;

  constructor(message: string) {
    super(message);
  }
}

/** Transaction was submitted but the network rejected it or reported ERROR. */
export class SorobanSubmissionError extends SorobanError {
  readonly kind = 'submission' as const;

  constructor(message: string) {
    super(message);
  }
}

/** Polling getTransaction exceeded the configured deadline. */
export class SorobanTimeoutError extends SorobanError {
  readonly kind = 'timeout' as const;

  constructor(message: string) {
    super(message);
  }
}

/** Missing/invalid Stellar configuration or agent account. */
export class SorobanConfigError extends SorobanError {
  readonly kind = 'config' as const;

  constructor(message: string) {
    super(message);
  }
}
