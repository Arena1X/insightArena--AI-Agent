import { Injectable } from '@nestjs/common';
import { DeadlineAdviceDto } from './dto/recommendation-response.dto';
import { EventDraftDto } from './dto/event-draft.dto';
import { FixtureDto } from './dto/fixture.dto';

/**
 * Deterministic (non-LLM) advice: which fixtures to include and when to set
 * the prediction deadline. Pure functions of the draft so the results are
 * stable and always available, even when the LLM is down.
 */
@Injectable()
export class RecommendationService {
  /**
   * Picks the recommended slate from the candidate pool. Strategy: prefer the
   * earliest-kickoff fixtures up to the desired count, so the event resolves
   * over a tight window. Falls back to a sensible default count.
   */
  recommendSlate(draft: EventDraftDto): FixtureDto[] {
    const desired = draft.desiredFixtureCount ?? Math.min(5, draft.candidateFixtures.length);
    return [...draft.candidateFixtures]
      .sort((a, b) => this.kickoff(a) - this.kickoff(b))
      .slice(0, Math.max(1, desired));
  }

  /**
   * Suggests a prediction cutoff 1 hour before the earliest kickoff in the
   * slate, so all picks lock before any match begins.
   */
  adviseDeadline(slate: FixtureDto[]): DeadlineAdviceDto {
    const earliest = slate.reduce(
      (min, f) => Math.min(min, this.kickoff(f)),
      Number.POSITIVE_INFINITY,
    );
    const cutoff = new Date(earliest - 60 * 60 * 1000);
    return {
      suggestedDeadline: cutoff.toISOString(),
      rationale:
        'Set to 1 hour before the earliest kickoff so all predictions lock before any match starts.',
    };
  }

  private kickoff(f: FixtureDto): number {
    return new Date(f.kickoffTime).getTime();
  }
}
