import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AssistantModule } from '../src/assistant/assistant.module';
import { LlmService } from '../src/assistant/llm/llm.service';

/**
 * E2E for POST /assistant/advise with a mocked LlmService. Verifies the single
 * endpoint returns fixtures + deadline + structure advice, and that grounding
 * drops any hallucinated team the (mocked) model returns.
 */
describe('AssistantController (e2e)', () => {
  let app: INestApplication;

  const draft = {
    title: 'Friday Night Footy',
    visibility: 'private',
    expectedParticipants: 12,
    desiredFixtureCount: 2,
    candidateFixtures: [
      {
        id: 'fx_1',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'Premier League',
        kickoffTime: '2026-07-25T15:00:00.000Z',
      },
      {
        id: 'fx_2',
        homeTeam: 'Liverpool',
        awayTeam: 'Everton',
        league: 'Premier League',
        kickoffTime: '2026-07-25T17:30:00.000Z',
      },
      {
        id: 'fx_3',
        homeTeam: 'Spurs',
        awayTeam: 'Fulham',
        league: 'Premier League',
        kickoffTime: '2026-07-26T12:00:00.000Z',
      },
    ],
  };

  // Mock returns one grounded tip (Arsenal is in the slate) and one
  // hallucinated tip (Barcelona is not) — the latter must be dropped.
  const llmMock = {
    isConfigured: () => true,
    complete: jest.fn().mockResolvedValue(
      JSON.stringify({
        scoringSuggestion: 'Award 3 points for an exact score, 1 for the result.',
        roundStructure: 'A single round resolved on match day.',
        engagementTips: [
          'Hype the Arsenal fixture as the headline match.',
          'Give a bonus for calling the Barcelona upset.',
          'Post a mid-event leaderboard update.',
        ],
        titleSuggestions: ['Friday Night Showdown', 'The Real Madrid Derby Special'],
      }),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AssistantModule],
    })
      .overrideProvider(LlmService)
      .useValue(llmMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns fixtures + deadline + grounded structure advice in one response', async () => {
    const res = await request(app.getHttpServer())
      .post('/assistant/advise')
      .send(draft)
      .expect(201);

    // Recommended slate: earliest 2 fixtures (desiredFixtureCount = 2).
    expect(res.body.recommendedSlate).toHaveLength(2);
    expect(res.body.recommendedSlate.map((f: any) => f.id)).toEqual([
      'fx_1',
      'fx_2',
    ]);

    // Deadline is 1 hour before earliest kickoff (15:00 -> 14:00).
    expect(res.body.deadline.suggestedDeadline).toBe('2026-07-25T14:00:00.000Z');

    // Structure advice present and came from the (mocked) LLM.
    expect(res.body.structureAdvice.fallbackUsed).toBe(false);
    expect(res.body.structureAdvice.scoringSuggestion).toContain('3 points');

    // Grounding: the Barcelona tip is dropped; the Arsenal tip survives.
    const tips: string[] = res.body.structureAdvice.engagementTips;
    expect(tips.some((t) => t.includes('Arsenal'))).toBe(true);
    expect(tips.some((t) => t.includes('Barcelona'))).toBe(false);

    // The Real Madrid title (not in slate) is dropped.
    const titles: string[] = res.body.structureAdvice.titleSuggestions;
    expect(titles.some((t) => t.includes('Real Madrid'))).toBe(false);
    expect(titles).toContain('Friday Night Showdown');
  });

  it('rejects an invalid draft (empty candidate fixtures)', async () => {
    await request(app.getHttpServer())
      .post('/assistant/advise')
      .send({ ...draft, candidateFixtures: [] })
      .expect(400);
  });
});
