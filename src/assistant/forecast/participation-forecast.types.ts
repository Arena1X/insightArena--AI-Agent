/**
 * Domain types for the participation-forecast feature.
 *
 * These are intentionally kept as plain interfaces (no ORM / class-validator
 * decorators) so the forecast service remains a pure, side-effect-free unit
 * that is easy to test and reason about.
 */

/** A single sports fixture that is part of a slate. */
export interface Fixture {
  /** UTC start time of the fixture. */
  startsAt: Date;
  /**
   * Creator-assigned or platform-derived interest score for this fixture,
   * expressed as a value in the range [0, 100].
   */
  interestScore: number;
}

/**
 * A slate is the collection of fixtures bundled into a prediction-market
 * event, together with metadata about the league they belong to.
 */
export interface Slate {
  fixtures: Fixture[];
  /**
   * How popular the league is on the platform.
   *   1 = top-tier  (e.g. Premier League, Champions League)
   *   2 = mid-tier  (e.g. Bundesliga, Serie A)
   *   3 = lower-tier (e.g. regional leagues)
   */
  leaguePopularityTier: 1 | 2 | 3;
}

/** The draft state of an event before it is published. */
export interface EventDraft {
  /** Whether the event is open to all users (true) or invite-only (false). */
  isPublic: boolean;
  /**
   * Time between when the creator publishes the event and the first
   * fixture kick-off, measured in hours.
   */
  joinWindowHours: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Direction of a factor's influence on participation appeal. */
export type FactorImpact = 'positive' | 'negative';

/**
 * A single heuristic factor's contribution to the overall appeal score.
 * All factor weights sum to 100, so individual contributions are in the
 * range [0, factor.weight] and their sum equals the final appealScore.
 */
export interface ForecastFactor {
  /** Human-readable identifier for the factor (camelCase). */
  name: string;
  /** Whether this factor helped or hurt the score. */
  impact: FactorImpact;
  /**
   * The maximum points this factor can contribute (i.e. its weight out of 100).
   * Documented alongside the FORECAST_WEIGHT_* environment variables.
   */
  weight: number;
  /**
   * The actual points this factor contributed to the final appealScore.
   * Always in the range [0, weight].
   */
  contribution: number;
}

/** The complete forecast result returned to callers. */
export interface ParticipationForecast {
  /** Overall participation appeal, 0–100 (sum of all factor contributions). */
  appealScore: number;
  /**
   * Per-factor breakdown so the frontend can render an explained bar chart.
   * Invariant: factors.reduce((s, f) => s + f.contribution, 0) === appealScore
   */
  factors: ForecastFactor[];
  /**
   * Concrete, actionable suggestions shown to the creator.
   * Always contains at least one entry when appealScore < 50.
   */
  suggestions: string[];
}
