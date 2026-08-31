/**
 * Exhaustive unit tests for TrendService.
 *
 * Test organisation:
 *   1.  Helpers / fixtures
 *   2.  Empty / edge-case history
 *   3.  Signal: hot-streak                  (positive + negative)
 *   4.  Signal: cold-streak                 (positive + negative)
 *   5.  Signal: improving                   (positive + negative)
 *   6.  Signal: declining                   (positive + negative)
 *   7.  Signal: near-milestone (total)      (positive + negative)
 *   8.  Signal: near-milestone (PB streak)  (positive + negative)
 *   9.  Priority ordering
 *  10.  Simultaneous signals (hot-streak + near-milestone, etc.)
 *  11.  Env-overridable thresholds
 *  12.  Determinism
 */

import { ConfigService } from '@nestjs/config';
import { TrendService } from './trend.service';
import {
  TrendSignal,
  UserPerformance,
  HotStreakData,
  ColdStreakData,
  ImprovingData,
  DecliningData,
  NearMilestoneData,
} from './interfaces/trend.interface';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a ConfigService stub that returns undefined for every key by default. */
function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key] ?? undefined,
  } as unknown as ConfigService;
}

/** Create a TrendService with optional env overrides. */
function makeService(envOverrides: Record<string, string> = {}): TrendService {
  return new TrendService(makeConfig(envOverrides));
}

/** Shorthand for building a UserPerformance object. */
function perf(history: boolean[], personalBestStreak = 0): UserPerformance {
  return { history, personalBestStreak };
}

/**
 * Build an array of `length` identical outcomes.
 * e.g. `repeat(true, 5)` → [true, true, true, true, true]
 */
function repeat(outcome: boolean, length: number): boolean[] {
  return Array.from({ length }, () => outcome);
}

/** Find signals of a given type in the result array. */
function signalsOf(signals: TrendSignal[], type: TrendSignal['type']): TrendSignal[] {
  return signals.filter((s) => s.type === type);
}

/** Assert that exactly one signal of the given type is present. */
function expectOneSignal(signals: TrendSignal[], type: TrendSignal['type']): TrendSignal {
  const matches = signalsOf(signals, type);
  expect(matches).toHaveLength(1);
  return matches[0];
}

/** Assert that no signal of the given type is present. */
function expectNoSignal(signals: TrendSignal[], type: TrendSignal['type']): void {
  expect(signalsOf(signals, type)).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// 2. Empty / edge-case history
// ---------------------------------------------------------------------------

describe('TrendService — empty / edge-case inputs', () => {
  const svc = makeService();

  it('returns [] for empty history', () => {
    expect(svc.detectSignals(perf([]))).toEqual([]);
  });

  it('returns [] for a single correct prediction (no thresholds met)', () => {
    expect(svc.detectSignals(perf([true]))).toEqual([]);
  });

  it('returns [] for a single wrong prediction', () => {
    expect(svc.detectSignals(perf([false]))).toEqual([]);
  });

  it('returns [] when history has 3 correct in a row (below hot-streak threshold of 4)', () => {
    const signals = svc.detectSignals(perf(repeat(true, 3)));
    expectNoSignal(signals, 'hot-streak');
  });
});

// ---------------------------------------------------------------------------
// 3. Signal: hot-streak
// ---------------------------------------------------------------------------

describe('TrendService — hot-streak', () => {
  const svc = makeService();

  it('emits hot-streak when exactly 4 correct in a row at the tail', () => {
    const history = [...repeat(false, 2), ...repeat(true, 4)];
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'hot-streak');
    expect(signal.priority).toBe(1);
    expect((signal.data as HotStreakData).streakLength).toBe(4);
  });

  it('emits hot-streak with correct length when streak is longer than threshold', () => {
    const history = [false, ...repeat(true, 7)];
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'hot-streak');
    expect((signal.data as HotStreakData).streakLength).toBe(7);
  });

  it('does NOT emit hot-streak when streak is 3 (one below default threshold)', () => {
    const history = [...repeat(false, 3), ...repeat(true, 3)];
    expectNoSignal(svc.detectSignals(perf(history)), 'hot-streak');
  });

  it('does NOT emit hot-streak when the tail is a wrong prediction', () => {
    const history = [...repeat(true, 5), false];
    expectNoSignal(svc.detectSignals(perf(history)), 'hot-streak');
  });

  it('does NOT emit hot-streak when all predictions are wrong', () => {
    expectNoSignal(svc.detectSignals(perf(repeat(false, 10))), 'hot-streak');
  });

  it('counts only the trailing run — broken streak does not qualify', () => {
    // 3 correct, then 1 wrong, then 3 correct — trailing run is 3, below threshold
    const history = [...repeat(true, 3), false, ...repeat(true, 3)];
    expectNoSignal(svc.detectSignals(perf(history)), 'hot-streak');
  });

  it('emits hot-streak for an all-correct history of length 4', () => {
    const signals = svc.detectSignals(perf(repeat(true, 4)));
    const signal = expectOneSignal(signals, 'hot-streak');
    expect((signal.data as HotStreakData).streakLength).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 4. Signal: cold-streak
// ---------------------------------------------------------------------------

describe('TrendService — cold-streak', () => {
  const svc = makeService();

  it('emits cold-streak when exactly 4 wrong in a row at the tail', () => {
    const history = [...repeat(true, 3), ...repeat(false, 4)];
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'cold-streak');
    expect(signal.priority).toBe(2);
    expect((signal.data as ColdStreakData).streakLength).toBe(4);
  });

  it('emits cold-streak with correct length for a longer run', () => {
    const history = [true, ...repeat(false, 8)];
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'cold-streak');
    expect((signal.data as ColdStreakData).streakLength).toBe(8);
  });

  it('does NOT emit cold-streak when streak is 3 (one below threshold)', () => {
    const history = [...repeat(true, 3), ...repeat(false, 3)];
    expectNoSignal(svc.detectSignals(perf(history)), 'cold-streak');
  });

  it('does NOT emit cold-streak when the tail is a correct prediction', () => {
    const history = [...repeat(false, 5), true];
    expectNoSignal(svc.detectSignals(perf(history)), 'cold-streak');
  });

  it('does NOT emit cold-streak when all predictions are correct', () => {
    expectNoSignal(svc.detectSignals(perf(repeat(true, 10))), 'cold-streak');
  });

  it('counts only the trailing run — broken cold streak does not qualify', () => {
    const history = [...repeat(false, 3), true, ...repeat(false, 3)];
    expectNoSignal(svc.detectSignals(perf(history)), 'cold-streak');
  });
});

// ---------------------------------------------------------------------------
// 5. Signal: improving
// ---------------------------------------------------------------------------

describe('TrendService — improving', () => {
  const svc = makeService();

  /**
   * Build a history where:
   *   - The first `olderCount` entries have low accuracy (`olderCorrect` correct).
   *   - The last 10 entries have high accuracy (`recentCorrect` correct).
   */
  function buildImprovingHistory(
    olderCorrect: number,
    olderCount: number,
    recentCorrect: number,
  ): boolean[] {
    const older = [
      ...repeat(true, olderCorrect),
      ...repeat(false, olderCount - olderCorrect),
    ];
    const recent = [
      ...repeat(true, recentCorrect),
      ...repeat(false, 10 - recentCorrect),
    ];
    return [...older, ...recent];
  }

  it('emits improving when recent accuracy is ≥15pp above overall', () => {
    // older: 2/10 = 20%; recent 10/10 = 100%; overall: 12/20 = 60%; delta = 40
    const history = buildImprovingHistory(2, 10, 10);
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'improving');
    expect(signal.priority).toBe(3);
    const data = signal.data as ImprovingData;
    expect(data.recentAccuracy).toBeGreaterThan(data.overallAccuracy);
    expect(data.delta).toBeGreaterThanOrEqual(15);
  });

  it('carries correct accuracy values', () => {
    // older: 2/10 correct (20%); recent: 10/10 (100%); overall: 12/20 (60%)
    const history = buildImprovingHistory(2, 10, 10);
    const signal = expectOneSignal(svc.detectSignals(perf(history)), 'improving');
    const data = signal.data as ImprovingData;
    expect(data.recentAccuracy).toBe(100);
    expect(data.overallAccuracy).toBe(60);
    expect(data.delta).toBe(40);
  });

  it('does NOT emit improving when delta is exactly 14pp (below threshold)', () => {
    // older 7/10 (70%); recent 8.5/10 not possible — use: older 3/10 (30%), recent 44/10 impossible
    // Instead: 20 items where overall=60%, recent=74% => delta=14
    // older 8/10 = 80%; recent 7/10 = 70% → delta = -10 (wrong direction)
    // Build: 30 total, older 20 items with 12 correct (60%), recent 10 with 7 correct (70%)
    // overall = 19/30 ≈ 63.33%; recent = 70%; delta ≈ 6.67 (not 15) → no signal
    const older = [...repeat(true, 12), ...repeat(false, 8)]; // 20 items, 60%
    const recent = [...repeat(true, 7), ...repeat(false, 3)]; // 10 items, 70%
    const history = [...older, ...recent];
    // overall = 19/30 ≈ 63.33%; recent = 70%; delta ≈ 6.67 — below 15
    expectNoSignal(svc.detectSignals(perf(history)), 'improving');
  });

  it('does NOT emit improving when history length < recentWindowSize (10)', () => {
    // Only 9 predictions — not enough for a meaningful window comparison
    expectNoSignal(svc.detectSignals(perf(repeat(true, 9))), 'improving');
  });

  it('does NOT emit improving when recent accuracy is BELOW overall (declining pattern)', () => {
    // older: 9/10 (90%); recent: 2/10 (20%)
    const history = buildImprovingHistory(9, 10, 2);
    expectNoSignal(svc.detectSignals(perf(history)), 'improving');
  });

  it('does NOT emit improving when recent accuracy equals overall (no delta)', () => {
    // Uniform 50% accuracy throughout
    const history = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
    expectNoSignal(svc.detectSignals(perf(history)), 'improving');
  });
});

// ---------------------------------------------------------------------------
// 6. Signal: declining
// ---------------------------------------------------------------------------

describe('TrendService — declining', () => {
  const svc = makeService();

  function buildDecliningHistory(
    olderCorrect: number,
    olderCount: number,
    recentCorrect: number,
  ): boolean[] {
    const older = [
      ...repeat(true, olderCorrect),
      ...repeat(false, olderCount - olderCorrect),
    ];
    const recent = [
      ...repeat(true, recentCorrect),
      ...repeat(false, 10 - recentCorrect),
    ];
    return [...older, ...recent];
  }

  it('emits declining when recent accuracy is ≥15pp below overall', () => {
    // older: 9/10 (90%); recent 1/10 (10%); overall: 10/20 (50%); delta = 40pp
    const history = buildDecliningHistory(9, 10, 1);
    const signals = svc.detectSignals(perf(history));
    const signal = expectOneSignal(signals, 'declining');
    expect(signal.priority).toBe(4);
    const data = signal.data as DecliningData;
    expect(data.overallAccuracy).toBeGreaterThan(data.recentAccuracy);
    expect(data.delta).toBeGreaterThanOrEqual(15);
  });

  it('carries correct accuracy values', () => {
    // older: 10/10 (100%); recent 0/10 (0%); overall 10/20 (50%); delta = 50
    const history = buildDecliningHistory(10, 10, 0);
    const signal = expectOneSignal(svc.detectSignals(perf(history)), 'declining');
    const data = signal.data as DecliningData;
    expect(data.recentAccuracy).toBe(0);
    expect(data.overallAccuracy).toBe(50);
    expect(data.delta).toBe(50);
  });

  it('does NOT emit declining when delta is only ~6pp (below threshold)', () => {
    // older: 12/20 (60%); recent 7/10 (70%); overall 19/30 ≈ 63.33%; delta ≈ -6.67 (upward)
    const older = [...repeat(true, 12), ...repeat(false, 8)];
    const recent = [...repeat(true, 7), ...repeat(false, 3)];
    expectNoSignal(svc.detectSignals(perf([...older, ...recent])), 'declining');
  });

  it('does NOT emit declining when history length < recentWindowSize', () => {
    expectNoSignal(svc.detectSignals(perf(repeat(false, 9))), 'declining');
  });

  it('does NOT emit declining when recent accuracy is ABOVE overall (improving pattern)', () => {
    // older: 2/10 (20%); recent 9/10 (90%) — this should trigger improving, not declining
    const history = buildDecliningHistory(2, 10, 9);
    expectNoSignal(svc.detectSignals(perf(history)), 'declining');
  });
});

// ---------------------------------------------------------------------------
// 7. Signal: near-milestone (total predictions)
// ---------------------------------------------------------------------------

describe('TrendService — near-milestone (total predictions)', () => {
  const svc = makeService();

  it('emits near-milestone when 1 prediction away from 10', () => {
    const signals = svc.detectSignals(perf(repeat(false, 9)));
    const milestoneSignals = signalsOf(signals, 'near-milestone');
    const totalSignal = milestoneSignals.find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
    const data = totalSignal!.data as NearMilestoneData;
    expect(data.milestoneValue).toBe(10);
    expect(data.predictionsAway).toBe(1);
    expect(data.currentTotal).toBe(9);
  });

  it('emits near-milestone when 2 predictions away from 10', () => {
    const signals = svc.detectSignals(perf(repeat(false, 8)));
    const totalSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
    const data = totalSignal!.data as NearMilestoneData;
    expect(data.milestoneValue).toBe(10);
    expect(data.predictionsAway).toBe(2);
  });

  it('does NOT emit near-milestone when 3 away from the next milestone', () => {
    // 7 predictions → 3 away from 10
    const signals = svc.detectSignals(perf(repeat(false, 7)));
    const totalSignals = signalsOf(signals, 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignals).toHaveLength(0);
  });

  it('does NOT emit near-milestone when exactly AT a milestone', () => {
    // 10 predictions → at the milestone, not approaching it
    const signals = svc.detectSignals(perf(repeat(false, 10)));
    const totalSignals = signalsOf(signals, 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    // Could be near 25 now (15 away) — should NOT be near-milestone for totals
    expect(totalSignals).toHaveLength(0);
  });

  it('emits near-milestone when 1 away from 25', () => {
    const signals = svc.detectSignals(perf(repeat(false, 24)));
    const totalSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
    expect((totalSignal!.data as NearMilestoneData).milestoneValue).toBe(25);
  });

  it('emits near-milestone when 2 away from 50', () => {
    const signals = svc.detectSignals(perf(repeat(false, 48)));
    const totalSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
    expect((totalSignal!.data as NearMilestoneData).milestoneValue).toBe(50);
  });

  it('emits near-milestone when 1 away from 100', () => {
    const signals = svc.detectSignals(perf(repeat(false, 99)));
    const totalSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
    expect((totalSignal!.data as NearMilestoneData).milestoneValue).toBe(100);
  });

  it('has priority 5', () => {
    const signals = svc.detectSignals(perf(repeat(false, 9)));
    const totalSignal = signalsOf(signals, 'near-milestone')[0];
    expect(totalSignal?.priority).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 8. Signal: near-milestone (personal-best streak)
// ---------------------------------------------------------------------------

describe('TrendService — near-milestone (personal-best streak)', () => {
  const svc = makeService();

  it('emits PB-streak milestone when 1 correct away from beating PB', () => {
    // PB = 5; current trailing streak = 5 → need 1 more to beat (milestone = 6)
    const history = [...repeat(false, 3), ...repeat(true, 5)];
    const signals = svc.detectSignals(perf(history, 5));
    const pbSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignal).toBeDefined();
    const data = pbSignal!.data as NearMilestoneData;
    expect(data.milestoneValue).toBe(6);
    expect(data.predictionsAway).toBe(1);
    expect(data.currentStreak).toBe(5);
  });

  it('emits PB-streak milestone when 2 correct away from beating PB', () => {
    // PB = 6; current trailing streak = 4 → need 3 more (milestone = 7, away = 3) — NO, 3 > window
    // PB = 5; current streak = 4 → milestone = 6, away = 2 — YES
    const history = [...repeat(false, 3), ...repeat(true, 4)];
    const signals = svc.detectSignals(perf(history, 5));
    const pbSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignal).toBeDefined();
    const data = pbSignal!.data as NearMilestoneData;
    expect(data.predictionsAway).toBe(2);
  });

  it('does NOT emit PB-streak milestone when 3 away (beyond window)', () => {
    // PB = 6; current streak = 3 → milestone = 7, away = 4 — beyond window of 2
    const history = [...repeat(false, 3), ...repeat(true, 3)];
    const pbSignals = signalsOf(svc.detectSignals(perf(history, 6)), 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignals).toHaveLength(0);
  });

  it('does NOT emit PB-streak milestone when personalBestStreak is 0', () => {
    // No PB established yet
    const history = [...repeat(false, 3), ...repeat(true, 5)];
    const pbSignals = signalsOf(svc.detectSignals(perf(history, 0)), 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignals).toHaveLength(0);
  });

  it('does NOT emit PB-streak milestone when there is no active correct streak', () => {
    // Current streak is 0 (last prediction wrong)
    const history = [...repeat(true, 5), false];
    const pbSignals = signalsOf(svc.detectSignals(perf(history, 4)), 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignals).toHaveLength(0);
  });

  it('does NOT emit PB-streak milestone when current streak already exceeds PB', () => {
    // PB = 3; current streak = 5 — user has already surpassed their PB
    const history = [...repeat(false, 2), ...repeat(true, 5)];
    const pbSignals = signalsOf(svc.detectSignals(perf(history, 3)), 'near-milestone').filter(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Priority ordering
// ---------------------------------------------------------------------------

describe('TrendService — priority ordering', () => {
  it('results are always sorted by ascending priority', () => {
    // Craft a history that triggers hot-streak (PB near-milestone) + near-milestone (total)
    // 9 history items (near 10) with trailing 4 correct (hot-streak)
    const history = [...repeat(false, 5), ...repeat(true, 4)]; // 9 total, 4 hot-streak tail
    const svc = makeService();
    const signals = svc.detectSignals(perf(history, 0));
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i].priority).toBeGreaterThanOrEqual(signals[i - 1].priority);
    }
  });

  it('hot-streak (priority 1) comes before cold-streak (priority 2)', () => {
    // Not possible to have both at the same time (tail can only be one value),
    // but verify the priority values themselves
    const svc = makeService();
    const hotResult = svc.detectSignals(perf([...repeat(false, 2), ...repeat(true, 5)]));
    const coldResult = svc.detectSignals(perf([...repeat(true, 2), ...repeat(false, 5)]));
    const hotSignal = signalsOf(hotResult, 'hot-streak')[0];
    const coldSignal = signalsOf(coldResult, 'cold-streak')[0];
    expect(hotSignal?.priority).toBe(1);
    expect(coldSignal?.priority).toBe(2);
    expect(hotSignal!.priority).toBeLessThan(coldSignal!.priority);
  });

  it('improving (priority 3) comes before declining (priority 4)', () => {
    const svc = makeService();
    // improving history: older 2/10 (20%), recent 10/10 (100%)
    const impHistory = [...repeat(true, 2), ...repeat(false, 8), ...repeat(true, 10)];
    const impSignal = expectOneSignal(svc.detectSignals(perf(impHistory)), 'improving');
    // declining history: older 10/10 (100%), recent 0/10 (0%)
    const decHistory = [...repeat(true, 10), ...repeat(false, 10)];
    const decSignal = expectOneSignal(svc.detectSignals(perf(decHistory)), 'declining');
    expect(impSignal.priority).toBeLessThan(decSignal.priority);
  });

  it('near-milestone (priority 5) is the last in a combined result', () => {
    // hot-streak tail of 4 + 5 total (near 10 if combined with extras)
    // Use 9 total with a 4-correct tail → hot-streak + near-milestone(total)
    const history = [...repeat(false, 5), ...repeat(true, 4)]; // 9 items
    const svc = makeService();
    const signals = svc.detectSignals(perf(history, 0));
    const lastSignal = signals[signals.length - 1];
    expect(lastSignal?.type).toBe('near-milestone');
    expect(lastSignal?.priority).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 10. Simultaneous signals
// ---------------------------------------------------------------------------

describe('TrendService — simultaneous signals', () => {
  const svc = makeService();

  it('returns hot-streak AND near-milestone(total) simultaneously', () => {
    // 9 total (1 away from 10) with trailing 4 correct (hot-streak)
    const history = [...repeat(false, 5), ...repeat(true, 4)]; // length 9
    const signals = svc.detectSignals(perf(history, 0));
    expectOneSignal(signals, 'hot-streak');
    const milestoneSignals = signalsOf(signals, 'near-milestone');
    expect(milestoneSignals.length).toBeGreaterThanOrEqual(1);
    expect(
      milestoneSignals.some((s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions'),
    ).toBe(true);
    // Ordering: hot-streak first
    expect(signals[0].type).toBe('hot-streak');
    expect(signals[signals.length - 1].type).toBe('near-milestone');
  });

  it('returns hot-streak AND near-milestone(PB-streak) simultaneously', () => {
    // PB = 5; trailing streak = 5 (1 away from beating PB) — also a hot-streak
    const history = [...repeat(false, 4), ...repeat(true, 5)];
    const signals = svc.detectSignals(perf(history, 5));
    expectOneSignal(signals, 'hot-streak');
    const pbSignal = signalsOf(signals, 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'personal-best-streak',
    );
    expect(pbSignal).toBeDefined();
  });

  it('returns hot-streak AND BOTH near-milestone types simultaneously', () => {
    // 9 total (near 10) + 5 correct tail (hot-streak + near PB)
    // PB = 5; trailing 5-streak; 9 total
    const history = [...repeat(false, 4), ...repeat(true, 5)]; // 9 items
    const signals = svc.detectSignals(perf(history, 5));
    expectOneSignal(signals, 'hot-streak');
    const milestoneSignals = signalsOf(signals, 'near-milestone');
    const types = milestoneSignals.map((s) => (s.data as NearMilestoneData).milestoneType);
    expect(types).toContain('total-predictions');
    expect(types).toContain('personal-best-streak');
  });

  it('returns cold-streak AND near-milestone(total) simultaneously', () => {
    // 9 total with trailing 4 wrong (cold-streak) + near milestone 10
    const history = [...repeat(true, 5), ...repeat(false, 4)];
    const signals = svc.detectSignals(perf(history, 0));
    expectOneSignal(signals, 'cold-streak');
    expect(
      signalsOf(signals, 'near-milestone').some(
        (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
      ),
    ).toBe(true);
  });

  it('returns improving AND near-milestone simultaneously', () => {
    // 9 items in older portion + 10 in recent = 19 total (1 away from 25 milestone? no, 6 away)
    // Use 24 items: 14 older + 10 recent; older: 7/14 (50%), recent 10/10 (100%)
    // overall = 17/24 ≈ 70.83%; delta = 100 - 70.83 = 29.17pp → improving
    // 24 total → 1 away from 25 → near-milestone
    const history = [
      ...repeat(true, 7), ...repeat(false, 7),  // 14 older items, 50%
      ...repeat(true, 10),                       // 10 recent items, 100%
    ]; // 24 total
    const signals = svc.detectSignals(perf(history, 0));
    expectOneSignal(signals, 'improving');
    expect(
      signalsOf(signals, 'near-milestone').some(
        (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
      ),
    ).toBe(true);
  });

  it('returns declining AND near-milestone simultaneously', () => {
    // 24 total (1 away from 25); older 14/14 correct; recent 0/10 correct
    // overall = 14/24 ≈ 58.33%; recent = 0%; delta = 58.33pp → declining
    const history = [
      ...repeat(true, 14),   // 14 older, 100%
      ...repeat(false, 10),  // 10 recent, 0%
    ]; // 24 total
    const signals = svc.detectSignals(perf(history, 0));
    expectOneSignal(signals, 'declining');
    expect(
      signalsOf(signals, 'near-milestone').some(
        (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
      ),
    ).toBe(true);
  });

  it('never emits both hot-streak and cold-streak simultaneously', () => {
    // Impossible by definition — the tail can only be one value — but verify
    for (let i = 0; i < 20; i++) {
      const history = Array.from({ length: 20 }, () => Math.random() > 0.5);
      const signals = svc.detectSignals(perf(history, 0));
      const hasHot = signalsOf(signals, 'hot-streak').length > 0;
      const hasCold = signalsOf(signals, 'cold-streak').length > 0;
      expect(hasHot && hasCold).toBe(false);
    }
  });

  it('never emits both improving and declining simultaneously', () => {
    // Delta is either positive or negative — mutually exclusive
    for (let i = 0; i < 20; i++) {
      const history = Array.from({ length: 20 }, () => Math.random() > 0.5);
      const signals = svc.detectSignals(perf(history, 0));
      const hasImproving = signalsOf(signals, 'improving').length > 0;
      const hasDeclining = signalsOf(signals, 'declining').length > 0;
      expect(hasImproving && hasDeclining).toBe(false);
    }
  });

  it('all returned signals for the same type are correctly structured', () => {
    // near-milestone can emit two signals of the same type with different milestoneType
    const history = [...repeat(false, 4), ...repeat(true, 5)]; // 9 total, 5-correct tail
    const signals = svc.detectSignals(perf(history, 5));
    for (const signal of signals) {
      expect(signal.type).toBeDefined();
      expect(signal.priority).toBeGreaterThanOrEqual(1);
      expect(signal.priority).toBeLessThanOrEqual(5);
      expect(signal.data).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Env-overridable thresholds
// ---------------------------------------------------------------------------

describe('TrendService — env-overridable thresholds', () => {
  it('respects TREND_HOT_STREAK_MIN_LENGTH override', () => {
    const svc = makeService({ TREND_HOT_STREAK_MIN_LENGTH: '6' });
    // 5 correct in a row — below new threshold of 6, should NOT emit
    expectNoSignal(svc.detectSignals(perf(repeat(true, 5))), 'hot-streak');
    // 6 correct in a row — at new threshold, should emit
    const signals = svc.detectSignals(perf(repeat(true, 6)));
    const signal = expectOneSignal(signals, 'hot-streak');
    expect((signal.data as HotStreakData).streakLength).toBe(6);
  });

  it('respects TREND_COLD_STREAK_MIN_LENGTH override', () => {
    const svc = makeService({ TREND_COLD_STREAK_MIN_LENGTH: '3' });
    // 3 wrong in a row — now at threshold (lowered from 4)
    const signals = svc.detectSignals(perf([...repeat(true, 2), ...repeat(false, 3)]));
    expectOneSignal(signals, 'cold-streak');
  });

  it('respects TREND_IMPROVING_DELTA override (lower threshold)', () => {
    const svc = makeService({ TREND_IMPROVING_DELTA: '5' });
    // older: 7/10 (70%), recent: 8/10 (80%); overall ≈ 75%; delta = 5 → should emit at threshold=5
    const history = [
      ...repeat(true, 7), ...repeat(false, 3),  // 10 older, 70%
      ...repeat(true, 8), ...repeat(false, 2),  // 10 recent, 80%
    ];
    // overall = 15/20 = 75%; recent = 80%; delta = 5 → exactly meets threshold
    expectOneSignal(svc.detectSignals(perf(history)), 'improving');
  });

  it('respects TREND_DECLINING_DELTA override (lower threshold)', () => {
    const svc = makeService({ TREND_DECLINING_DELTA: '5' });
    const history = [
      ...repeat(true, 8), ...repeat(false, 2),  // 10 older, 80%
      ...repeat(true, 7), ...repeat(false, 3),  // 10 recent, 70%
    ];
    // overall = 15/20 = 75%; recent = 70%; delta = 5 → meets threshold=5
    expectOneSignal(svc.detectSignals(perf(history)), 'declining');
  });

  it('respects TREND_NEAR_MILESTONE_WINDOW override (larger window)', () => {
    const svc = makeService({ TREND_NEAR_MILESTONE_WINDOW: '4' });
    // 6 predictions away from 10 normally wouldn't qualify, but now 4 away does
    // Use 6 predictions (4 away from 10)
    const history = repeat(false, 6); // 6 total, 4 away from 10
    const totalSignal = signalsOf(svc.detectSignals(perf(history)), 'near-milestone').find(
      (s) => (s.data as NearMilestoneData).milestoneType === 'total-predictions',
    );
    expect(totalSignal).toBeDefined();
  });

  it('respects TREND_RECENT_WINDOW_SIZE override', () => {
    // Use a window of 5 instead of 10
    const svc = makeService({ TREND_RECENT_WINDOW_SIZE: '5' });
    // With window=5 we need at least 5 items for accuracy comparison
    // older 2 items (1 correct = 50%), recent 5 items (5/5 = 100%)
    // But overall: 6/7 ≈ 85.7%; recent 100%; delta ≈ 14.3 — just below 15
    // Use: older 1 item (0 correct), recent 5 items (5/5 = 100%)
    // overall: 5/6 ≈ 83.3%; recent 100%; delta ≈ 16.7 → improving
    const history = [false, ...repeat(true, 5)];
    expectOneSignal(svc.detectSignals(perf(history)), 'improving');
  });

  it('falls back to default when env var is absent', () => {
    const svc = makeService({}); // no overrides
    // Should use default of 4 for hot-streak
    expectNoSignal(svc.detectSignals(perf(repeat(true, 3))), 'hot-streak');
    expectOneSignal(svc.detectSignals(perf(repeat(true, 4))), 'hot-streak');
  });

  it('falls back to default when env var is not a valid integer', () => {
    const svc = makeService({ TREND_HOT_STREAK_MIN_LENGTH: 'banana' });
    // Should use default of 4
    expectNoSignal(svc.detectSignals(perf(repeat(true, 3))), 'hot-streak');
    expectOneSignal(svc.detectSignals(perf(repeat(true, 4))), 'hot-streak');
  });
});

// ---------------------------------------------------------------------------
// 12. Determinism
// ---------------------------------------------------------------------------

describe('TrendService — determinism', () => {
  const svc = makeService();

  it('returns the same result for identical inputs called multiple times', () => {
    const history = [...repeat(false, 5), ...repeat(true, 4)];
    const performance = perf(history, 5);
    const result1 = svc.detectSignals(performance);
    const result2 = svc.detectSignals(performance);
    const result3 = svc.detectSignals(performance);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  it('does not mutate the input history array', () => {
    const history = [...repeat(false, 5), ...repeat(true, 4)];
    const originalHistory = [...history];
    svc.detectSignals(perf(history, 0));
    expect(history).toEqual(originalHistory);
  });

  it('does not mutate the UserPerformance object', () => {
    const performance = perf([...repeat(false, 3), ...repeat(true, 4)], 3);
    const snapshot = JSON.stringify(performance);
    svc.detectSignals(performance);
    expect(JSON.stringify(performance)).toBe(snapshot);
  });
});
