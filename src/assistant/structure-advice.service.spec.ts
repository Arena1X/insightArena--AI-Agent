import { Test } from '@nestjs/testing';
import { StructureAdviceService } from './structure-advice.service';
import { LlmService } from './llm/llm.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { FixtureDto } from './dto/fixture.dto';

const slate: FixtureDto[] = [
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
];

const draft: EventDraftDto = {
  title: 'Friday Night Footy',
  visibility: 'private',
  expectedParticipants: 12,
  desiredFixtureCount: 2,
  candidateFixtures: slate,
};

/** Builds a StructureAdviceService with a stubbed LlmService. */
async function buildService(llmStub: Partial<LlmService>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StructureAdviceService,
      { provide: LlmService, useValue: llmStub },
    ],
  }).compile();
  return moduleRef.get(StructureAdviceService);
}

describe('StructureAdviceService', () => {
  describe('grounding filter', () => {
    it('drops tips that mention a team not in the slate', async () => {
      const llmOutput = JSON.stringify({
        scoringSuggestion: 'Award 3 points for an exact score, 1 for the result.',
        roundStructure: 'A single round of 2 fixtures.',
        engagementTips: [
          'Hype up the Arsenal vs Chelsea clash as the marquee fixture.', // grounded — kept
          'Add a bonus Manchester United vs Tottenham derby for extra points.', // hallucinated — dropped
        ],
        titleSuggestions: [
          'Friday Night Footy Showdown', // no unknown team — kept
          'The Barcelona Invitational', // hallucinated — dropped
        ],
      });

      const service = await buildService({
        isConfigured: () => true,
        complete: jest.fn().mockResolvedValue(llmOutput),
      });

      const result = await service.advise(draft, slate);

      expect(result.fallbackUsed).toBe(false);
      expect(result.engagementTips).toEqual([
        'Hype up the Arsenal vs Chelsea clash as the marquee fixture.',
      ]);
      expect(result.titleSuggestions).toEqual(['Friday Night Footy Showdown']);
      // No surviving advice references a team outside the slate.
      const joined = [
        ...result.engagementTips,
        ...result.titleSuggestions,
      ].join(' ');
      expect(joined).not.toMatch(/Manchester United|Tottenham|Barcelona/);
    });

    it('caps engagement tips and titles at 3', async () => {
      const llmOutput = JSON.stringify({
        scoringSuggestion: 'Score it.',
        roundStructure: 'One round.',
        engagementTips: ['Tip one.', 'Tip two.', 'Tip three.', 'Tip four.'],
        titleSuggestions: ['One', 'Two', 'Three', 'Four'],
      });
      const service = await buildService({
        isConfigured: () => true,
        complete: jest.fn().mockResolvedValue(llmOutput),
      });

      const result = await service.advise(draft, slate);
      expect(result.engagementTips.length).toBeLessThanOrEqual(3);
      expect(result.titleSuggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('fallback path', () => {
    it('returns deterministic advice when the LLM throws', async () => {
      const service = await buildService({
        isConfigured: () => true,
        complete: jest.fn().mockRejectedValue(new Error('upstream 503')),
      });

      const result = await service.advise(draft, slate);
      expect(result.fallbackUsed).toBe(true);
      expect(result.scoringSuggestion).toBeTruthy();
      expect(result.roundStructure).toBeTruthy();
      expect(result.engagementTips.length).toBeGreaterThan(0);
      expect(result.titleSuggestions.length).toBeGreaterThan(0);
    });

    it('returns fallback when the LLM is not configured', async () => {
      const service = await buildService({
        isConfigured: () => false,
        complete: jest.fn(),
      });

      const result = await service.advise(draft, slate);
      expect(result.fallbackUsed).toBe(true);
      expect((service as any).llm.complete).not.toHaveBeenCalled();
    });

    it('falls back when the LLM returns non-JSON', async () => {
      const service = await buildService({
        isConfigured: () => true,
        complete: jest.fn().mockResolvedValue('not json at all'),
      });

      const result = await service.advise(draft, slate);
      expect(result.fallbackUsed).toBe(true);
    });

    it('fallback advice never references specific slate teams', async () => {
      const service = await buildService({
        isConfigured: () => false,
        complete: jest.fn(),
      });
      const result = await service.advise(draft, slate);
      const joined = [
        result.scoringSuggestion,
        result.roundStructure,
        ...result.engagementTips,
        ...result.titleSuggestions,
      ].join(' ');
      expect(joined).not.toMatch(/Arsenal|Chelsea|Liverpool|Everton/);
    });
  });
});
