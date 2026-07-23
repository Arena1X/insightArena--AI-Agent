import { Test } from '@nestjs/testing';
import { NamingService, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from './naming.service';
import { LlmService } from './llm/llm.service';
import { NamingRequestDto } from './dto/naming.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a NamingService with a stubbed LlmService. */
async function buildService(llmStub: Partial<LlmService>) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      NamingService,
      { provide: LlmService, useValue: llmStub },
    ],
  }).compile();
  return moduleRef.get(NamingService);
}

const baseDto: NamingRequestDto = {
  slateSummary: 'Arsenal vs Chelsea, Liverpool vs Everton — Premier League, 25 Jul 2026',
};

/** Builds a valid LLM JSON response string. */
function makeLlmResponse(overrides: { titles?: string[]; description?: string } = {}): string {
  return JSON.stringify({
    titles: overrides.titles ?? [
      'Premier League Showdown',
      'The Gunners Gauntlet',
      'Top-Four Battle',
    ],
    description:
      overrides.description ??
      'Four top-flight clashes packed into one slate. Pick your winners before the whistle blows.',
  });
}

// ---------------------------------------------------------------------------
// Length enforcement
// ---------------------------------------------------------------------------

describe('NamingService — length enforcement', () => {
  it('truncates titles longer than 40 chars at the nearest word boundary', async () => {
    // 76-char title — word boundary at "That" (pos 36) is the last safe cut ≤ 40 chars
    const longTitle = 'This Is A Very Long Event Title That Goes Way Over The Forty Character Limit';
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({ titles: [longTitle, 'Short Title', 'Another Short One'] }),
      ),
    });

    const result = await service.generateNames(baseDto);

    // Length constraint is met
    expect(result.titles[0].length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    // Word-boundary truncation: the result must not end with a partial word
    // i.e. it should end right before or at a space boundary (no trailing space)
    expect(result.titles[0]).not.toMatch(/\s$/);
    expect(result.titles[0]).toBe(result.titles[0].trim());
  });

  it('returns all titles at or under 40 chars even when LLM returns overly long ones', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({
          titles: [
            'A'.repeat(60),
            'B'.repeat(50),
            'C'.repeat(45),
          ],
        }),
      ),
    });

    const result = await service.generateNames(baseDto);
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
  });

  it('truncates description longer than 200 chars at the nearest word boundary', async () => {
    const longDesc =
      'This is a very long event description that will definitely exceed the two-hundred character ' +
      'limit set for descriptions in the InsightArena Creator Assistant naming feature endpoint.';
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({ description: longDesc }),
      ),
    });

    const result = await service.generateNames(baseDto);
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it('preserves titles that are exactly 40 chars without truncation', async () => {
    const exactly40 = 'A'.repeat(40);
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({ titles: [exactly40, 'Short', 'Also Short'] }),
      ),
    });

    const result = await service.generateNames(baseDto);
    expect(result.titles[0]).toBe(exactly40);
    expect(result.titles[0].length).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Profanity blocklist
// ---------------------------------------------------------------------------

describe('NamingService — profanity blocklist', () => {
  it('replaces a title containing a blocked term with a fallback title', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({
          titles: ['The fucking Premier League', 'Clean Title', 'Another Clean'],
        }),
      ),
    });

    const result = await service.generateNames(baseDto);
    // The blocked title should have been swapped out
    expect(result.titles[0]).not.toMatch(/fuck/i);
    // Still returns exactly 3 titles
    expect(result.titles).toHaveLength(3);
    // All within length limit
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
  });

  it('replaces description containing a blocked term with a fallback description', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({
          description: 'This is some shit event description for testing.',
        }),
      ),
    });

    const result = await service.generateNames(baseDto);
    expect(result.description).not.toMatch(/shit/i);
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(result.description.trim().length).toBeGreaterThan(0);
  });

  it('returns clean output when all LLM candidates are safe', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(makeLlmResponse()),
    });

    const result = await service.generateNames(baseDto);
    const allText = [...result.titles, result.description].join(' ');
    // None of the common blocklist terms should be present
    expect(allText).not.toMatch(/\b(fuck|shit|bitch|cunt|damn|crap)\b/i);
  });
});

// ---------------------------------------------------------------------------
// Cache hit
// ---------------------------------------------------------------------------

describe('NamingService — cache', () => {
  it('returns cached response and skips the LLM on an identical request', async () => {
    const completeMock = jest.fn().mockResolvedValue(makeLlmResponse());
    const service = await buildService({
      isConfigured: () => true,
      complete: completeMock,
    });

    // First call — populates cache
    const first = await service.generateNames(baseDto);
    // Second call — should hit cache
    const second = await service.generateNames(baseDto);

    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(second.cachedAt).toBe(first.cachedAt);
    expect(second.titles).toEqual(first.titles);
    expect(second.description).toBe(first.description);
  });

  it('calls the LLM again for a request with different slateSummary', async () => {
    const completeMock = jest.fn().mockResolvedValue(makeLlmResponse());
    const service = await buildService({
      isConfigured: () => true,
      complete: completeMock,
    });

    await service.generateNames(baseDto);
    await service.generateNames({ slateSummary: 'Totally different slate summary' });

    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it('calls the LLM again after cache expiry', async () => {
    const completeMock = jest.fn().mockResolvedValue(makeLlmResponse());
    const service = await buildService({
      isConfigured: () => true,
      complete: completeMock,
    });

    // Pre-seed an expired cache entry
    const key = service._buildCacheKey(baseDto);
    service._setCacheEntry(key, {
      response: {
        titles: ['Stale Title One', 'Stale Two', 'Stale Three'],
        description: 'Stale description.',
        fallbackUsed: false,
        cachedAt: new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString(),
      },
      expiresAt: Date.now() - 1_000, // already expired
    });

    const result = await service.generateNames(baseDto);

    // LLM should have been called (cache miss)
    expect(completeMock).toHaveBeenCalledTimes(1);
    // Should NOT return stale data
    expect(result.titles).not.toContain('Stale Title One');
  });

  it('different context produces a different cache key', async () => {
    const completeMock = jest.fn().mockResolvedValue(makeLlmResponse());
    const service = await buildService({
      isConfigured: () => true,
      complete: completeMock,
    });

    await service.generateNames(baseDto);
    await service.generateNames({ ...baseDto, context: 'casual tone' });

    expect(completeMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

describe('NamingService — fallback', () => {
  it('returns fallback when LLM is not configured', async () => {
    const completeMock = jest.fn();
    const service = await buildService({
      isConfigured: () => false,
      complete: completeMock,
    });

    const result = await service.generateNames(baseDto);

    expect(completeMock).not.toHaveBeenCalled();
    expect(result.fallbackUsed).toBe(true);
    expect(result.titles).toHaveLength(3);
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it('returns fallback when LLM throws', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockRejectedValue(new Error('upstream 503')),
    });

    const result = await service.generateNames(baseDto);

    expect(result.fallbackUsed).toBe(true);
    expect(result.titles).toHaveLength(3);
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it('returns fallback when LLM returns non-JSON', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue('not json at all'),
    });

    const result = await service.generateNames(baseDto);
    expect(result.fallbackUsed).toBe(true);
  });

  it('returns fallback when LLM JSON is missing required fields', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(JSON.stringify({ wrong: 'shape' })),
    });

    const result = await service.generateNames(baseDto);
    expect(result.fallbackUsed).toBe(true);
  });

  it('fallback titles are always valid (length ≤ 40, no blocked terms)', async () => {
    const service = await buildService({
      isConfigured: () => false,
      complete: jest.fn(),
    });

    const result = await service.generateNames({
      slateSummary: 'Juventus vs Napoli — Serie A, 25 Jul 2026',
    });

    expect(result.fallbackUsed).toBe(true);
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(title.trim().length).toBeGreaterThan(0);
    }
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it('fallback titles include a week label derived from a date in the summary', async () => {
    const service = await buildService({
      isConfigured: () => false,
      complete: jest.fn(),
    });

    const result = await service.generateNames({
      slateSummary: 'Some match — 25 Jul 2026',
    });

    expect(result.fallbackUsed).toBe(true);
    // At least one fallback title should contain the date label
    const joined = result.titles.join(' ');
    expect(joined).toMatch(/25 Jul 2026/i);
  });
});

// ---------------------------------------------------------------------------
// Always-valid guarantee (combined)
// ---------------------------------------------------------------------------

describe('NamingService — always-valid output guarantee', () => {
  it('never returns a title exceeding 40 chars regardless of LLM content', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({
          titles: [
            'A very long title that should be safely truncated by the service to comply',
            'Another very long title that also needs truncating for compliance reasons here',
            'Yet another title that is longer than the maximum allowed length of forty chars',
          ],
        }),
      ),
    });

    const result = await service.generateNames(baseDto);
    for (const title of result.titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
  });

  it('never returns a description exceeding 200 chars regardless of LLM content', async () => {
    const service = await buildService({
      isConfigured: () => true,
      complete: jest.fn().mockResolvedValue(
        makeLlmResponse({
          description: 'x'.repeat(500),
        }),
      ),
    });

    const result = await service.generateNames(baseDto);
    expect(result.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });
});
