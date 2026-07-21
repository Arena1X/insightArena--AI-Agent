import { ApiProperty } from '@nestjs/swagger';
import { FixtureDto } from './fixture.dto';

/**
 * Deadline advice for the recommended slate: a single suggested prediction
 * cutoff plus the reasoning behind it.
 */
export class DeadlineAdviceDto {
  @ApiProperty({
    example: '2026-07-25T14:00:00.000Z',
    description: 'Recommended prediction cutoff (ISO-8601)',
  })
  suggestedDeadline: string;

  @ApiProperty({
    example: 'Set to 1 hour before the earliest kickoff to lock all picks.',
  })
  rationale: string;
}

/**
 * Structure advice as returned to the client. Mirrors the LLM contract but
 * lives as a DTO so Swagger can document it. Populated either from the LLM
 * (after grounding) or from the deterministic fallback.
 */
export class StructureAdviceDto {
  @ApiProperty({ example: 'Award 3 points for an exact scoreline, 1 for the correct result.' })
  scoringSuggestion: string;

  @ApiProperty({ example: 'A single round of 5 fixtures resolved on match day.' })
  roundStructure: string;

  @ApiProperty({
    type: [String],
    example: ['Share a mid-week leaderboard nudge', 'Add a bonus derby fixture'],
    description: 'Up to 3 engagement hooks',
  })
  engagementTips: string[];

  @ApiProperty({
    type: [String],
    example: ['Friday Night Footy Showdown', 'The Gameweek Gauntlet'],
    description: 'Up to 3 title suggestions',
  })
  titleSuggestions: string[];

  @ApiProperty({
    example: true,
    description: 'True when advice came from the deterministic fallback rather than the LLM',
  })
  fallbackUsed: boolean;
}

/**
 * The single combined response for POST /assistant/advise: the recommended
 * slate, deadline advice, and grounded structure advice in one payload.
 */
export class RecommendationResponseDto {
  @ApiProperty({ type: [FixtureDto], description: 'Recommended slate of fixtures' })
  recommendedSlate: FixtureDto[];

  @ApiProperty({ type: DeadlineAdviceDto })
  deadline: DeadlineAdviceDto;

  @ApiProperty({ type: StructureAdviceDto })
  structureAdvice: StructureAdviceDto;
}
