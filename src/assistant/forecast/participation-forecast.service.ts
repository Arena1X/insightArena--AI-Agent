import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventDraft,
  ForecastFactor,
  FactorImpact,
  ParticipationForecast,
  Slate,
} from './participation-forecast.types';

// ---------------------------------------------------------------------------
// Weight documentation
// ---------------------------------------------------------------------------
//
// Each factor is allocated a share of 100 points.  The actual contribution
// of a factor is always in the range [0, weight], so the sum of all
// contributions equals the final appealScore (invariant tested in spec).
//
// Default weights (overridable via environment variables):
//
//   Factor                  | Default weight | Env override
//   ------------------------|----------------|------------------------------------
//   weekendFixtureRatio     |      15        | FORECAST_WEIGHT_WEEKEND
//   averageSlateInterest    |      25        | FORECAST_WEIGHT_INTEREST
//   leaguePopularityTier    |      20        | FORECAST_WEIGHT_LEAGUE
//   joinWindowLength        |      15        | FORECAST_WEIGHT_JOIN_WINDOW
//   publicVisibility        |      10        | FORECAST_WEIGHT_VISIBILITY
//   slateSizeVsSweetSpot    |      15        | FORECAST_WEIGHT_SLATE_SIZE
//                           |     100        |
//
// Note: If env overrides cause the total to deviate from 100 the service
// still functions correctly — the invariant (sum of contributions =
// appealScore) holds regardless of the total weight sum because the
// appealScore itself is derived as that sum.
//
// ---------------------------------------------------------------------------

/** Sweet-spot slate size range (inclusive). */
const SWEET_SPOT_MIN = 5;
const SWEET_SPOT_MAX = 10;

/** Join-window sweet spot (hours). */
const JOIN_WINDOW_MIN_HOURS = 24;
const JOIN_WINDOW_MAX_HOURS = 72;

@Injectable()
export class ParticipationForecastService {
  private readonly logger = new Logger(ParticipationForecastService.name);

  /** Resolved factor weights — set once in constructor from env / defaults. */
  private readonly weights: {
    weekend: number;
    interest: number;
    league: number;
    joinWindow: number;
    visibility: number;
    slateSize: number;
  };

  constructor(private readonly configService: ConfigService) {
    this.weights = {
      weekend: this.resolveWeight('FORECAST_WEIGHT_WEEKEND', 15),
      interest: this.resolveWeight('FORECAST_WEIGHT_INTEREST', 25),
      league: this.resolveWeight('FORECAST_WEIGHT_LEAGUE', 20),
      joinWindow: this.resolveWeight('FORECAST_WEIGHT_JOIN_WINDOW', 15),
      visibility: this.resolveWeight('FORECAST_WEIGHT_VISIBILITY', 10),
      slateSize: this.resolveWeight('FORECAST_WEIGHT_SLATE_SIZE', 15),
    };
    this.logger.debug('Resolved forecast weights: ' + JSON.stringify(this.weights));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Estimate the participation appeal of a draft event.
   *
   * @param draft  The event draft (visibility, join-window length).
   * @param slate  The slate of fixtures with their interest scores and league tier.
   * @returns      A deterministic {@link ParticipationForecast} — no I/O, no randomness.
   */
  forecast(draft: EventDraft, slate: Slate): ParticipationForecast {
    const factors: ForecastFactor[] = [
      this.scoreWeekendFixtureRatio(slate),
      this.scoreAverageSlateInterest(slate),
      this.scoreLeaguePopularityTier(slate),
      this.scoreJoinWindowLength(draft),
      this.scorePublicVisibility(draft),
      this.scoreSlateSizeVsSweetSpot(slate),
    ];

    const appealScore = Math.round(
      factors.reduce((sum, f) => sum + f.contribution, 0),
    );

    const suggestions = this.buildSuggestions(draft, slate, appealScore, factors);

    return { appealScore, factors, suggestions };
  }

  // ---------------------------------------------------------------------------
  // Individual factor scorers
  // Each returns a ForecastFactor with contribution in [0, weight].
  // ---------------------------------------------------------------------------

  /**
   * Factor 1 — Weekend fixture ratio (weight: FORECAST_WEIGHT_WEEKEND, default 15)
   *
   * Weekend fixtures (Saturday & Sunday) attract a larger casual audience.
   * A slate where all fixtures fall on weekends scores the full weight;
   * a fully weekday slate scores 0.
   *
   * Benchmark: weekday-only slates receive 0/15 on this factor, which
   * contributes to the ~40 % fewer joins observed for weekday-only events.
   */
  private scoreWeekendFixtureRatio(slate: Slate): ForecastFactor {
    const weight = this.weights.weekend;
    const name = 'weekendFixtureRatio';

    if (slate.fixtures.length === 0) {
      return this.makeFactor(name, 'negative', weight, 0);
    }

    const weekendCount = slate.fixtures.filter((f) =>
      this.isWeekend(f.startsAt),
    ).length;
    const ratio = weekendCount / slate.fixtures.length;
    const contribution = this.precise(ratio * weight);
    const impact: FactorImpact = ratio >= 0.5 ? 'positive' : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  /**
   * Factor 2 — Average slate interest score (weight: FORECAST_WEIGHT_INTEREST, default 25)
   *
   * The mean of per-fixture interest scores (0–100) drives this factor.
   * High-interest fixtures generate more organic discussion and joins.
   */
  private scoreAverageSlateInterest(slate: Slate): ForecastFactor {
    const weight = this.weights.interest;
    const name = 'averageSlateInterestScore';

    if (slate.fixtures.length === 0) {
      return this.makeFactor(name, 'negative', weight, 0);
    }

    const avg =
      slate.fixtures.reduce((s, f) => s + f.interestScore, 0) /
      slate.fixtures.length;
    // Clamp avg to [0,100] defensively in case callers pass out-of-range values.
    const clamped = Math.min(100, Math.max(0, avg));
    const contribution = this.precise((clamped / 100) * weight);
    const impact: FactorImpact = clamped >= 50 ? 'positive' : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  /**
   * Factor 3 — League popularity tier (weight: FORECAST_WEIGHT_LEAGUE, default 20)
   *
   * Tier mapping:
   *   1 (top)    → full weight   (100 %)
   *   2 (mid)    → 60 % of weight
   *   3 (lower)  → 25 % of weight
   */
  private scoreLeaguePopularityTier(slate: Slate): ForecastFactor {
    const weight = this.weights.league;
    const name = 'leaguePopularityTier';
    const tierRatioMap: Record<1 | 2 | 3, number> = { 1: 1.0, 2: 0.6, 3: 0.25 };
    const ratio = tierRatioMap[slate.leaguePopularityTier] ?? 0.25;
    const contribution = this.precise(ratio * weight);
    const impact: FactorImpact = slate.leaguePopularityTier === 1 ? 'positive' : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  /**
   * Factor 4 — Join-window length (weight: FORECAST_WEIGHT_JOIN_WINDOW, default 15)
   *
   * The window between publish time and the first fixture kick-off gives
   * potential participants time to discover and join.
   *
   *   < 24 h  → too short; linearly scaled from 0 at 0 h to full at 24 h
   *   24–72 h → sweet spot → full weight
   *   > 72 h  → diminishing returns; linearly decays to 50 % at 168 h (7 days)
   *             and stays at 50 % beyond that
   */
  private scoreJoinWindowLength(draft: EventDraft): ForecastFactor {
    const weight = this.weights.joinWindow;
    const name = 'joinWindowLength';
    const hours = draft.joinWindowHours;

    let ratio: number;
    if (hours <= 0) {
      ratio = 0;
    } else if (hours < JOIN_WINDOW_MIN_HOURS) {
      ratio = hours / JOIN_WINDOW_MIN_HOURS;
    } else if (hours <= JOIN_WINDOW_MAX_HOURS) {
      ratio = 1.0;
    } else {
      // Decay from 1.0 at 72 h to 0.5 at 168 h, floor at 0.5.
      const decayRange = 168 - JOIN_WINDOW_MAX_HOURS; // 96 h
      const over = Math.min(hours - JOIN_WINDOW_MAX_HOURS, decayRange);
      ratio = 1.0 - 0.5 * (over / decayRange);
    }

    const contribution = this.precise(ratio * weight);
    const impact: FactorImpact =
      hours >= JOIN_WINDOW_MIN_HOURS && hours <= JOIN_WINDOW_MAX_HOURS
        ? 'positive'
        : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  /**
   * Factor 5 — Public vs private visibility (weight: FORECAST_WEIGHT_VISIBILITY, default 10)
   *
   * Public events are discoverable by all users; private events are
   * invite-only and inherently reach a smaller audience.
   *
   *   public  → full weight
   *   private → 0
   */
  private scorePublicVisibility(draft: EventDraft): ForecastFactor {
    const weight = this.weights.visibility;
    const name = 'publicVisibility';
    const contribution = draft.isPublic ? weight : 0;
    const impact: FactorImpact = draft.isPublic ? 'positive' : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  /**
   * Factor 6 — Slate size vs sweet spot (weight: FORECAST_WEIGHT_SLATE_SIZE, default 15)
   *
   * Empirically, slates with 5–10 fixtures balance variety with
   * decision fatigue.  Scoring:
   *   size in [5, 10]  → full weight
   *   size < 5         → linearly scaled from 0 at 0 to full at 5
   *   size > 10        → linearly decays from full at 10 to 50 % at 20,
   *                      floor at 50 %
   */
  private scoreSlateSizeVsSweetSpot(slate: Slate): ForecastFactor {
    const weight = this.weights.slateSize;
    const name = 'slateSizeVsSweetSpot';
    const size = slate.fixtures.length;

    let ratio: number;
    if (size <= 0) {
      ratio = 0;
    } else if (size < SWEET_SPOT_MIN) {
      ratio = size / SWEET_SPOT_MIN;
    } else if (size <= SWEET_SPOT_MAX) {
      ratio = 1.0;
    } else {
      const decayRange = 20 - SWEET_SPOT_MAX; // 10
      const over = Math.min(size - SWEET_SPOT_MAX, decayRange);
      ratio = 1.0 - 0.5 * (over / decayRange);
    }

    const contribution = this.precise(ratio * weight);
    const impact: FactorImpact =
      size >= SWEET_SPOT_MIN && size <= SWEET_SPOT_MAX ? 'positive' : 'negative';

    return this.makeFactor(name, impact, weight, contribution);
  }

  // ---------------------------------------------------------------------------
  // Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Build a list of concrete, actionable suggestions.
   *
   * Rule: when appealScore < 50 there will always be at least one suggestion.
   * Suggestions are also generated for moderate scores to help creators
   * push their events to the highest possible tier.
   */
  private buildSuggestions(
    draft: EventDraft,
    slate: Slate,
    appealScore: number,
    factors: ForecastFactor[],
  ): string[] {
    const suggestions: string[] = [];

    const get = (name: string) => factors.find((f) => f.name === name);

    // --- Weekend fixture ratio ---
    const wf = get('weekendFixtureRatio');
    if (wf && wf.contribution < wf.weight * 0.5) {
      const weekendCount = slate.fixtures.filter((f) =>
        this.isWeekend(f.startsAt),
      ).length;
      const weekdayCount = slate.fixtures.length - weekendCount;
      suggestions.push(
        `Weekday-only slates get ~40 % fewer joins. ` +
          `${weekdayCount} of your ${slate.fixtures.length} fixture(s) fall on weekdays — ` +
          `swap some in for weekend games to boost discovery.`,
      );
    }

    // --- Average interest score ---
    const ai = get('averageSlateInterestScore');
    if (ai && ai.contribution < ai.weight * 0.5) {
      suggestions.push(
        `Your slate's average interest score is low. ` +
          `Replace lower-interest fixtures with higher-profile matchups ` +
          `(aim for an average interest score above 50).`,
      );
    }

    // --- League tier ---
    const lt = get('leaguePopularityTier');
    if (lt && slate.leaguePopularityTier === 3) {
      suggestions.push(
        `Tier-3 leagues attract a niche audience. ` +
          `Consider mixing in fixtures from a tier-1 or tier-2 league ` +
          `to widen your event's appeal.`,
      );
    } else if (lt && slate.leaguePopularityTier === 2) {
      suggestions.push(
        `Adding at least one top-tier league fixture can meaningfully ` +
          `increase participation for mid-tier slates.`,
      );
    }

    // --- Join window ---
    const jw = get('joinWindowLength');
    if (jw && draft.joinWindowHours < JOIN_WINDOW_MIN_HOURS) {
      suggestions.push(
        `A join window under ${JOIN_WINDOW_MIN_HOURS} hours gives users too little ` +
          `time to discover your event. Publish at least 24 hours before ` +
          `the first kick-off.`,
      );
    } else if (jw && draft.joinWindowHours > JOIN_WINDOW_MAX_HOURS) {
      suggestions.push(
        `A join window longer than ${JOIN_WINDOW_MAX_HOURS} hours can cause ` +
          `participants to lose interest before the event starts. ` +
          `Consider publishing closer to kick-off (24–72 hours before).`,
      );
    }

    // --- Visibility ---
    if (!draft.isPublic) {
      suggestions.push(
        `Private events are invite-only, which limits reach significantly. ` +
          `Switch to public visibility to appear in discovery feeds.`,
      );
    }

    // --- Slate size ---
    const ss = get('slateSizeVsSweetSpot');
    if (ss) {
      const size = slate.fixtures.length;
      if (size < SWEET_SPOT_MIN) {
        suggestions.push(
          `Slates with fewer than ${SWEET_SPOT_MIN} fixtures feel thin. ` +
            `Add more fixtures to reach the sweet spot of ${SWEET_SPOT_MIN}–${SWEET_SPOT_MAX}.`,
        );
      } else if (size > SWEET_SPOT_MAX) {
        suggestions.push(
          `Slates with more than ${SWEET_SPOT_MAX} fixtures can overwhelm participants. ` +
            `Trim your slate to the sweet spot of ${SWEET_SPOT_MIN}–${SWEET_SPOT_MAX} fixtures.`,
        );
      }
    }

    // Guarantee at least one suggestion for low-scoring events.
    if (appealScore < 50 && suggestions.length === 0) {
      suggestions.push(
        `Your event's appeal score is ${appealScore}/100. ` +
          `Focus on adding weekend fixtures from a popular league with a ` +
          `24–72 hour join window to improve participation.`,
      );
    }

    return suggestions;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Returns true when the given date falls on a Saturday or Sunday (UTC). */
  private isWeekend(date: Date): boolean {
    const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  }

  /** Construct a ForecastFactor with contribution clamped to [0, weight]. */
  private makeFactor(
    name: string,
    impact: FactorImpact,
    weight: number,
    rawContribution: number,
  ): ForecastFactor {
    return {
      name,
      impact,
      weight,
      contribution: Math.min(weight, Math.max(0, rawContribution)),
    };
  }

  /**
   * Round to two decimal places to avoid floating-point accumulation noise.
   * The final appealScore is subsequently rounded to an integer.
   */
  private precise(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** Read an env-var as a positive number; fall back to defaultValue. */
  private resolveWeight(envKey: string, defaultValue: number): number {
    const raw = this.configService.get<string>(envKey);
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    this.logger.warn(
      `Invalid value for ${envKey}: "${raw}". Using default ${defaultValue}.`,
    );
    return defaultValue;
  }
}
