/**
 * Exhaustive unit tests for ParticipationForecastService.
 *
 * Test organisation:
 *   1. Helpers / fixtures
 *   2. Factor: weekendFixtureRatio        (isolated)
 *   3. Factor: averageSlateInterestScore  (isolated)
 *   4. Factor: leaguePopularityTier       (isolated)
 *   5. Factor: joinWindowLength           (isolated)
 *   6. Factor: publicVisibility           (isolated)
 *   7. Factor: slateSizeVsSweetSpot       (isolated)
 *   8. Invariant: sum(contributions) === appealScore
 *   9. Suggestions: low score always has ≥ 1 suggestion
 *  10. Suggestions: each trigger checked individually
 *  11. Combined cases (realistic end-to-end scenarios)
 *  12. Env-overridable weights
 */

import { ConfigService } from '@nestjs/config';
import { ParticipationForecastService } from './participation-forecast.service';
import { EventDraft, Fixture, ParticipationForecast, Slate } from './participation-forecast.types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a ConfigService stub that returns undefined for every key. */
function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key] ?? undefined,
  } as unknown as ConfigService;
}

/** Create a service instance with default (unoverridden) weights. */
function makeService(envOverrides: Record<string, string> = {}): ParticipationForecastService {
  return new ParticipationForecastService(makeConfig(envOverrides));
}


// ---------------------------------------------------------------------------
// Date helpers — all times in UTC to keep tests deterministic
// ---------------------------------------------------------------------------

/** 2024-01-06 is a Saturday UTC */
const SAT = new Date('2024-01-06T15:00:00Z');
/** 2024-01-07 is a Sunday UTC */
const SUN = new Date('2024-01-07T15:00:00Z');
/** 2024-01-08 is a Monday UTC */
const MON = new Date('2024-01-08T15:00:00Z');
/** 2024-01-09 is a Tuesday UTC */
const TUE = new Date('2024-01-09T15:00:00Z');
/** 2024-01-10 is a Wednesday UTC */
const WED = new Date('2024-01-10T15:00:00Z');

function fixture(startsAt: Date, interestScore: number): Fixture {
  return { startsAt, interestScore };
}

/** Builds a slate with all fixtures having the given interest score. */
function slateOf(
  dates: Date[],
  interestScore: number,
  tier: 1 | 2 | 3 = 1,
): Slate {
  return {
    fixtures: dates.map((d) => fixture(d, interestScore)),
    leaguePopularityTier: tier,
  };
}

/** "Perfect" draft — public, sweet-spot join window. */
const GOOD_DRAFT: EventDraft = { isPublic: true, joinWindowHours: 48 };
/** "Bad" draft — private, tiny join window. */
const BAD_DRAFT: EventDraft = { isPublic: false, joinWindowHours: 1 };

/** Verifies the invariant: sum of contributions rounded equals appealScore. */
function assertInvariant(result: ParticipationForecast): void {
  const sumContributions = result.factors.reduce((s, f) => s + f.contribution, 0);
  expect(Math.round(sumContributions)).toBe(result.appealScore);
}


// ===========================================================================
// 2. Factor: weekendFixtureRatio
// ===========================================================================

describe('ParticipationForecastService', () => {
  let svc: ParticipationForecastService;

  beforeEach(() => {
    svc = makeService();
  });

  // -------------------------------------------------------------------------
  describe('factor: weekendFixtureRatio', () => {
    it('scores full weight (15) when all fixtures are on weekends', () => {
      const slate = slateOf([SAT, SUN, SAT], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
      expect(f.weight).toBe(15);
    });

    it('scores 0 when all fixtures are on weekdays', () => {
      const slate = slateOf([MON, TUE, WED], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });

    it('scores 50 % weight for a half-weekend slate', () => {
      const slate = slateOf([SAT, MON], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      // 1/2 * 15 = 7.5
      expect(f.contribution).toBe(7.5);
      expect(f.impact).toBe('positive'); // ratio === 0.5 → positive
    });

    it('scores 0 and marks negative for an empty fixture list', () => {
      const slate: Slate = { fixtures: [], leaguePopularityTier: 1 };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });

    it('recognises Sunday as a weekend day', () => {
      const slate = slateOf([SUN], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.contribution).toBe(15);
    });

    it('impact is negative when fewer than 50 % are weekend fixtures', () => {
      // 1 weekend out of 3 → 33 % < 50 %
      const slate = slateOf([SAT, MON, TUE], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.impact).toBe('negative');
      // 1/3 * 15 ≈ 5
      expect(f.contribution).toBeCloseTo(5, 1);
    });
  });


  // ===========================================================================
  // 3. Factor: averageSlateInterestScore
  // ===========================================================================
  describe('factor: averageSlateInterestScore', () => {
    it('scores full weight (25) when all fixtures have interest 100', () => {
      const slate = slateOf([SAT, SUN], 100, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(25);
      expect(f.impact).toBe('positive');
    });

    it('scores 0 when all fixtures have interest 0', () => {
      const slate = slateOf([SAT, SUN], 0, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });

    it('scores proportionally for a mixed slate', () => {
      // avg = (20 + 80) / 2 = 50 → contribution = 50/100 * 25 = 12.5
      const slate: Slate = {
        fixtures: [fixture(SAT, 20), fixture(SUN, 80)],
        leaguePopularityTier: 1,
      };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(12.5);
      expect(f.impact).toBe('positive'); // avg === 50 → positive
    });

    it('impact is negative when average is below 50', () => {
      const slate = slateOf([SAT], 49, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.impact).toBe('negative');
    });

    it('clamps out-of-range interest scores above 100', () => {
      const slate: Slate = {
        fixtures: [fixture(SAT, 200)],
        leaguePopularityTier: 1,
      };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(25); // clamped to 100 → full weight
    });

    it('clamps out-of-range interest scores below 0', () => {
      const slate: Slate = {
        fixtures: [fixture(SAT, -50)],
        leaguePopularityTier: 1,
      };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(0);
    });

    it('scores 0 and marks negative for an empty fixture list', () => {
      const slate: Slate = { fixtures: [], leaguePopularityTier: 1 };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });
  });


  // ===========================================================================
  // 4. Factor: leaguePopularityTier
  // ===========================================================================
  describe('factor: leaguePopularityTier', () => {
    it('tier 1 → full weight (20) and positive impact', () => {
      const slate = slateOf([SAT], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'leaguePopularityTier');
      expect(f.contribution).toBe(20);
      expect(f.impact).toBe('positive');
    });

    it('tier 2 → 60 % of weight (12) and negative impact', () => {
      const slate = slateOf([SAT], 80, 2);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'leaguePopularityTier');
      expect(f.contribution).toBe(12);
      expect(f.impact).toBe('negative');
    });

    it('tier 3 → 25 % of weight (5) and negative impact', () => {
      const slate = slateOf([SAT], 80, 3);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'leaguePopularityTier');
      expect(f.contribution).toBe(5);
      expect(f.impact).toBe('negative');
    });
  });

  // ===========================================================================
  // 5. Factor: joinWindowLength
  // ===========================================================================
  describe('factor: joinWindowLength', () => {
    it('0 hours → contribution 0, negative', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 0 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });

    it('12 hours → 50 % of weight, negative', () => {
      // ratio = 12/24 = 0.5 → contribution = 0.5 * 15 = 7.5
      const draft: EventDraft = { isPublic: true, joinWindowHours: 12 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(7.5);
      expect(f.impact).toBe('negative');
    });

    it('24 hours → full weight (15), positive', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 24 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('48 hours (sweet spot mid) → full weight (15), positive', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('72 hours (sweet spot max) → full weight (15), positive', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 72 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('168 hours → 50 % weight (7.5), negative', () => {
      // over = min(168-72, 96) = 96; ratio = 1 - 0.5*(96/96) = 0.5
      const draft: EventDraft = { isPublic: true, joinWindowHours: 168 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(7.5);
      expect(f.impact).toBe('negative');
    });

    it('beyond 168 hours floors at 50 % weight (7.5)', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 500 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(7.5);
    });

    it('120 hours → midpoint decay value, negative', () => {
      // over = 120-72 = 48; decayRange=96; ratio = 1 - 0.5*(48/96) = 0.75
      // contribution = 0.75 * 15 = 11.25
      const draft: EventDraft = { isPublic: true, joinWindowHours: 120 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.contribution).toBe(11.25);
      expect(f.impact).toBe('negative');
    });
  });


  // ===========================================================================
  // 6. Factor: publicVisibility
  // ===========================================================================
  describe('factor: publicVisibility', () => {
    it('public → full weight (10) and positive impact', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'publicVisibility');
      expect(f.contribution).toBe(10);
      expect(f.impact).toBe('positive');
    });

    it('private → contribution 0 and negative impact', () => {
      const draft: EventDraft = { isPublic: false, joinWindowHours: 48 };
      const { factors } = svc.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'publicVisibility');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });
  });

  // ===========================================================================
  // 7. Factor: slateSizeVsSweetSpot
  // ===========================================================================
  describe('factor: slateSizeVsSweetSpot', () => {
    it('0 fixtures → contribution 0, negative', () => {
      const slate: Slate = { fixtures: [], leaguePopularityTier: 1 };
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(0);
      expect(f.impact).toBe('negative');
    });

    it('1 fixture → 20 % weight (3), negative', () => {
      // ratio = 1/5 = 0.2 → 0.2 * 15 = 3
      const slate = slateOf([SAT], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(3);
      expect(f.impact).toBe('negative');
    });

    it('4 fixtures → 80 % weight (12), negative', () => {
      // ratio = 4/5 = 0.8 → 0.8 * 15 = 12
      const slate = slateOf([SAT, SAT, SAT, SAT], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(12);
      expect(f.impact).toBe('negative');
    });

    it('5 fixtures (sweet spot min) → full weight (15), positive', () => {
      const slate = slateOf([SAT, SAT, SAT, SAT, SAT], 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('7 fixtures (sweet spot mid) → full weight (15), positive', () => {
      const slate = slateOf(Array(7).fill(SAT), 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('10 fixtures (sweet spot max) → full weight (15), positive', () => {
      const slate = slateOf(Array(10).fill(SAT), 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(15);
      expect(f.impact).toBe('positive');
    });

    it('15 fixtures → 75 % weight, negative', () => {
      // over = min(15-10,10) = 5; ratio = 1 - 0.5*(5/10) = 0.75 → 0.75*15 = 11.25
      const slate = slateOf(Array(15).fill(SAT), 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(11.25);
      expect(f.impact).toBe('negative');
    });

    it('20 fixtures → 50 % weight (7.5), negative', () => {
      // over = 10; ratio = 1 - 0.5*(10/10) = 0.5 → 0.5*15 = 7.5
      const slate = slateOf(Array(20).fill(SAT), 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(7.5);
    });

    it('beyond 20 fixtures floors at 50 % weight (7.5)', () => {
      const slate = slateOf(Array(50).fill(SAT), 80, 1);
      const { factors } = svc.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.contribution).toBe(7.5);
    });
  });


  // ===========================================================================
  // 8. Invariant: sum(contributions) === appealScore (across many inputs)
  // ===========================================================================
  describe('invariant: sum of contributions equals appealScore', () => {
    const cases: Array<{ label: string; draft: EventDraft; slate: Slate }> = [
      {
        label: 'perfect event',
        draft: { isPublic: true, joinWindowHours: 48 },
        slate: slateOf(Array(7).fill(SAT), 90, 1),
      },
      {
        label: 'worst-case event',
        draft: { isPublic: false, joinWindowHours: 1 },
        slate: slateOf([MON], 0, 3),
      },
      {
        label: 'mixed weekend / weekday',
        draft: { isPublic: true, joinWindowHours: 24 },
        slate: slateOf([SAT, MON, TUE], 60, 2),
      },
      {
        label: 'tiny slate',
        draft: { isPublic: true, joinWindowHours: 48 },
        slate: slateOf([SAT, SUN], 75, 1),
      },
      {
        label: 'oversized slate',
        draft: { isPublic: true, joinWindowHours: 48 },
        slate: slateOf(Array(25).fill(SUN), 70, 1),
      },
      {
        label: 'zero join window',
        draft: { isPublic: true, joinWindowHours: 0 },
        slate: slateOf([SAT], 80, 1),
      },
      {
        label: 'very long join window',
        draft: { isPublic: true, joinWindowHours: 500 },
        slate: slateOf([SAT], 80, 1),
      },
      {
        label: 'empty slate',
        draft: { isPublic: true, joinWindowHours: 48 },
        slate: { fixtures: [], leaguePopularityTier: 1 },
      },
    ];

    cases.forEach(({ label, draft, slate }) => {
      it(`holds for: ${label}`, () => {
        const result = svc.forecast(draft, slate);
        assertInvariant(result);
      });
    });

    it('all factor names are unique in the result', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      const names = result.factors.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('result always has exactly 6 factors', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      expect(result.factors).toHaveLength(6);
    });

    it('no factor contribution exceeds its weight', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      result.factors.forEach((f) => {
        expect(f.contribution).toBeGreaterThanOrEqual(0);
        expect(f.contribution).toBeLessThanOrEqual(f.weight);
      });
    });

    it('appealScore is an integer', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      expect(Number.isInteger(result.appealScore)).toBe(true);
    });
  });


  // ===========================================================================
  // 9. Suggestions: low score always has >= 1 suggestion
  // ===========================================================================
  describe('suggestions: low appeal score always has at least one suggestion', () => {
    it('guaranteed suggestion when appealScore < 50 — worst-case private weekday event', () => {
      const result = svc.forecast(BAD_DRAFT, slateOf([MON], 0, 3));
      expect(result.appealScore).toBeLessThan(50);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('all suggestions are non-empty strings', () => {
      const result = svc.forecast(BAD_DRAFT, slateOf([MON], 0, 3));
      result.suggestions.forEach((s) => {
        expect(typeof s).toBe('string');
        expect(s.trim().length).toBeGreaterThan(0);
      });
    });

    it('suggestions array exists even for a high-scoring event', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf(Array(7).fill(SAT), 95, 1));
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  // ===========================================================================
  // 10. Suggestions: each trigger checked individually
  // ===========================================================================
  describe('suggestions: individual triggers', () => {
    it('suggests swapping weekday fixtures when weekday-only slate', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([MON, TUE], 80, 1));
      const weekdaySugg = result.suggestions.find((s) =>
        s.includes('weekday'),
      );
      expect(weekdaySugg).toBeDefined();
    });

    it('no weekday suggestion when all fixtures are on weekends', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT, SUN], 80, 1));
      const weekdaySugg = result.suggestions.find((s) =>
        s.includes('weekday-only'),
      );
      expect(weekdaySugg).toBeUndefined();
    });

    it('suggests improving interest score when avg < 50 % of weight', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 0, 1));
      const interestSugg = result.suggestions.find((s) =>
        s.includes('interest score'),
      );
      expect(interestSugg).toBeDefined();
    });

    it('no interest suggestion when avg interest is high', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 90, 1));
      const interestSugg = result.suggestions.find((s) =>
        s.includes('average interest score is low'),
      );
      expect(interestSugg).toBeUndefined();
    });

    it('suggests tier-3 league upgrade', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 3));
      const tierSugg = result.suggestions.find((s) => s.includes('Tier-3'));
      expect(tierSugg).toBeDefined();
    });

    it('suggests tier-2 league upgrade', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 2));
      const tierSugg = result.suggestions.find((s) =>
        s.includes('top-tier league fixture'),
      );
      expect(tierSugg).toBeDefined();
    });

    it('no league suggestion for tier-1', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      const tierSugg = result.suggestions.find(
        (s) => s.includes('Tier-3') || s.includes('top-tier'),
      );
      expect(tierSugg).toBeUndefined();
    });

    it('suggests publishing earlier when join window < 24 h', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 10 };
      const result = svc.forecast(draft, slateOf([SAT], 80, 1));
      const jSugg = result.suggestions.find((s) =>
        s.includes('24 hours before'),
      );
      expect(jSugg).toBeDefined();
    });

    it('suggests trimming join window when > 72 h', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 200 };
      const result = svc.forecast(draft, slateOf([SAT], 80, 1));
      const jSugg = result.suggestions.find((s) =>
        s.includes('lose interest'),
      );
      expect(jSugg).toBeDefined();
    });

    it('no join-window suggestion in the sweet spot', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const result = svc.forecast(draft, slateOf([SAT], 80, 1));
      const jSugg = result.suggestions.find(
        (s) => s.includes('24 hours before') || s.includes('lose interest'),
      );
      expect(jSugg).toBeUndefined();
    });

    it('suggests switching to public when event is private', () => {
      const draft: EventDraft = { isPublic: false, joinWindowHours: 48 };
      const result = svc.forecast(draft, slateOf([SAT], 80, 1));
      const privSugg = result.suggestions.find((s) =>
        s.includes('Private events'),
      );
      expect(privSugg).toBeDefined();
    });

    it('no visibility suggestion for a public event', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      const privSugg = result.suggestions.find((s) =>
        s.includes('Private events'),
      );
      expect(privSugg).toBeUndefined();
    });

    it('suggests adding more fixtures when slate size < 5', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf([SAT, SUN], 80, 1));
      const sizeSugg = result.suggestions.find((s) =>
        s.includes('fewer than 5'),
      );
      expect(sizeSugg).toBeDefined();
    });

    it('suggests trimming when slate size > 10', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf(Array(15).fill(SAT), 80, 1));
      const sizeSugg = result.suggestions.find((s) =>
        s.includes('more than 10'),
      );
      expect(sizeSugg).toBeDefined();
    });

    it('no slate-size suggestion in the sweet spot', () => {
      const result = svc.forecast(GOOD_DRAFT, slateOf(Array(7).fill(SAT), 80, 1));
      const sizeSugg = result.suggestions.find(
        (s) => s.includes('fewer than 5') || s.includes('more than 10'),
      );
      expect(sizeSugg).toBeUndefined();
    });
  });


  // ===========================================================================
  // 11. Combined / end-to-end scenarios
  // ===========================================================================
  describe('combined scenarios', () => {
    it('ideal event scores close to 100', () => {
      // All factors maxed:
      //   weekend ratio = 1   → 15
      //   interest avg  = 100 → 25
      //   tier 1              → 20
      //   join window 48 h    → 15
      //   public              → 10
      //   size 7              → 15
      // Total = 100
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const slate = slateOf(Array(7).fill(SAT), 100, 1);
      const result = svc.forecast(draft, slate);
      expect(result.appealScore).toBe(100);
      assertInvariant(result);
    });

    it('worst-case event scores very low', () => {
      // All factors zeroed / minimum:
      //   weekend ratio = 0       → 0
      //   interest avg  = 0       → 0
      //   tier 3                  → 5
      //   join window 0 h         → 0
      //   private                 → 0
      //   size 1 (1/5*15=3)       → 3
      // Total = 8 → rounds to 8
      const draft: EventDraft = { isPublic: false, joinWindowHours: 0 };
      const slate = slateOf([MON], 0, 3);
      const result = svc.forecast(draft, slate);
      expect(result.appealScore).toBe(8);
      assertInvariant(result);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('weekday slate with good other factors still triggers weekday suggestion', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const slate = slateOf([MON, TUE, WED, MON, TUE, WED, MON], 90, 1);
      const result = svc.forecast(draft, slate);
      const weekdaySugg = result.suggestions.find((s) => s.includes('weekday'));
      expect(weekdaySugg).toBeDefined();
      assertInvariant(result);
    });

    it('private event suggestion appears alongside other suggestions', () => {
      const draft: EventDraft = { isPublic: false, joinWindowHours: 48 };
      const slate = slateOf(Array(7).fill(SAT), 80, 1);
      const result = svc.forecast(draft, slate);
      const privSugg = result.suggestions.find((s) => s.includes('Private events'));
      expect(privSugg).toBeDefined();
      assertInvariant(result);
    });

    it('result is deterministic — calling twice returns the same score', () => {
      const draft: EventDraft = { isPublic: true, joinWindowHours: 36 };
      const slate = slateOf([SAT, MON, SAT], 65, 2);
      const r1 = svc.forecast(draft, slate);
      const r2 = svc.forecast(draft, slate);
      expect(r1.appealScore).toBe(r2.appealScore);
      expect(r1.factors.map((f) => f.contribution)).toEqual(
        r2.factors.map((f) => f.contribution),
      );
    });

    it('mixed weekend and weekday slate scores proportionally', () => {
      // 3 weekends, 3 weekdays → ratio 0.5 → weekendFixtureRatio contribution = 7.5
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const slate: Slate = {
        fixtures: [
          fixture(SAT, 80), fixture(SUN, 80), fixture(SAT, 80),
          fixture(MON, 80), fixture(TUE, 80), fixture(WED, 80),
        ],
        leaguePopularityTier: 1,
      };
      const result = svc.forecast(draft, slate);
      const wf = result.factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(wf.contribution).toBe(7.5);
      assertInvariant(result);
    });
  });


  // ===========================================================================
  // 12. Env-overridable weights
  // ===========================================================================
  describe('env-overridable weights', () => {
    it('FORECAST_WEIGHT_WEEKEND overrides the weekend factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_WEEKEND: '30' });
      const slate = slateOf([SAT], 80, 1);
      const { factors } = custom.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.weight).toBe(30);
      expect(f.contribution).toBe(30); // all weekend → full weight
    });

    it('FORECAST_WEIGHT_INTEREST overrides the interest factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_INTEREST: '50' });
      const slate = slateOf([SAT], 100, 1);
      const { factors } = custom.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'averageSlateInterestScore');
      expect(f.weight).toBe(50);
      expect(f.contribution).toBe(50);
    });

    it('FORECAST_WEIGHT_LEAGUE overrides the league factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_LEAGUE: '40' });
      const slate = slateOf([SAT], 80, 1);
      const { factors } = custom.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'leaguePopularityTier');
      expect(f.weight).toBe(40);
      expect(f.contribution).toBe(40); // tier 1 → full weight
    });

    it('FORECAST_WEIGHT_JOIN_WINDOW overrides the join-window factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_JOIN_WINDOW: '20' });
      const draft: EventDraft = { isPublic: true, joinWindowHours: 48 };
      const { factors } = custom.forecast(draft, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'joinWindowLength');
      expect(f.weight).toBe(20);
      expect(f.contribution).toBe(20);
    });

    it('FORECAST_WEIGHT_VISIBILITY overrides the visibility factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_VISIBILITY: '20' });
      const { factors } = custom.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'publicVisibility');
      expect(f.weight).toBe(20);
      expect(f.contribution).toBe(20);
    });

    it('FORECAST_WEIGHT_SLATE_SIZE overrides the slate-size factor weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_SLATE_SIZE: '25' });
      const slate = slateOf(Array(7).fill(SAT), 80, 1);
      const { factors } = custom.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'slateSizeVsSweetSpot');
      expect(f.weight).toBe(25);
      expect(f.contribution).toBe(25);
    });

    it('invalid env value falls back to default weight', () => {
      const custom = makeService({ FORECAST_WEIGHT_WEEKEND: 'not-a-number' });
      const slate = slateOf([SAT], 80, 1);
      const { factors } = custom.forecast(GOOD_DRAFT, slate);
      const f = factors.find((x) => x.name === 'weekendFixtureRatio');
      expect(f.weight).toBe(15); // default
    });

    it('zero env weight sets factor contribution to 0', () => {
      const custom = makeService({ FORECAST_WEIGHT_VISIBILITY: '0' });
      const { factors } = custom.forecast(GOOD_DRAFT, slateOf([SAT], 80, 1));
      const f = factors.find((x) => x.name === 'publicVisibility');
      expect(f.weight).toBe(0);
      expect(f.contribution).toBe(0);
    });

    it('invariant still holds when custom weights are applied', () => {
      const custom = makeService({
        FORECAST_WEIGHT_WEEKEND: '20',
        FORECAST_WEIGHT_INTEREST: '30',
        FORECAST_WEIGHT_LEAGUE: '15',
        FORECAST_WEIGHT_JOIN_WINDOW: '10',
        FORECAST_WEIGHT_VISIBILITY: '15',
        FORECAST_WEIGHT_SLATE_SIZE: '10',
      });
      const result = custom.forecast(GOOD_DRAFT, slateOf(Array(7).fill(SAT), 80, 1));
      assertInvariant(result);
    });
  });
}); // end describe('ParticipationForecastService')
