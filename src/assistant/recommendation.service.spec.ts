import { RecommendationService } from './recommendation.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { FixtureDto } from './dto/fixture.dto';

const fixtures: FixtureDto[] = [
  { id: 'a', homeTeam: 'A', awayTeam: 'B', kickoffTime: '2026-07-25T18:00:00.000Z' },
  { id: 'b', homeTeam: 'C', awayTeam: 'D', kickoffTime: '2026-07-25T15:00:00.000Z' },
  { id: 'c', homeTeam: 'E', awayTeam: 'F', kickoffTime: '2026-07-25T20:00:00.000Z' },
];

describe('RecommendationService', () => {
  const service = new RecommendationService();

  it('recommends earliest-kickoff fixtures up to the desired count', () => {
    const draft = {
      title: 't',
      visibility: 'public',
      desiredFixtureCount: 2,
      candidateFixtures: fixtures,
    } as EventDraftDto;

    const slate = service.recommendSlate(draft);
    expect(slate.map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('defaults to min(5, candidates) when count is unset', () => {
    const draft = {
      title: 't',
      visibility: 'public',
      candidateFixtures: fixtures,
    } as EventDraftDto;
    expect(service.recommendSlate(draft)).toHaveLength(3);
  });

  it('suggests a deadline one hour before the earliest kickoff', () => {
    const draft = {
      title: 't',
      visibility: 'public',
      candidateFixtures: fixtures,
    } as EventDraftDto;
    const slate = service.recommendSlate(draft);
    const advice = service.adviseDeadline(slate);
    // earliest kickoff is 15:00Z -> deadline 14:00Z
    expect(advice.suggestedDeadline).toBe('2026-07-25T14:00:00.000Z');
    expect(advice.rationale).toBeTruthy();
  });
});
