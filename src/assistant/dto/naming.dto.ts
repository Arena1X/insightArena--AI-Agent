import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Input to POST /assistant/naming.
 * `slateSummary` describes the fixture slate in free text (e.g.
 * "Arsenal vs Chelsea, Liverpool vs Everton — Premier League, 25 Jul 2026").
 * It is the only required field; `context` is an optional hint about tone,
 * audience, or format.
 */
export class NamingRequestDto {
  @ApiProperty({
    example:
      'Arsenal vs Chelsea, Liverpool vs Everton — Premier League, 25 Jul 2026',
    description:
      'Free-text summary of the fixture slate for which titles and a description should be generated.',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  slateSummary: string;

  @ApiPropertyOptional({
    example: 'casual, fun tone for a friends group',
    description:
      'Optional hint about the desired tone or audience (passed to the LLM as extra context).',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  context?: string;
}

/**
 * Response from POST /assistant/naming.
 *
 * - `titles`: exactly 3 candidates, each ≤ 40 characters.
 * - `description`: one event description, ≤ 200 characters.
 * - `fallbackUsed`: true when the LLM call failed and deterministic titles
 *   were returned instead.
 * - `cachedAt`: ISO-8601 timestamp of when this response was first generated
 *   (same for cached hits within the 24-hour window).
 */
export class NamingResponseDto {
  @ApiProperty({
    type: [String],
    example: [
      'Premier League Showdown',
      'The Gunners Gauntlet',
      'Top-Four Battle',
    ],
    description: 'Three title candidates, each at most 40 characters.',
  })
  titles: string[];

  @ApiProperty({
    example:
      'Four top-flight clashes packed into one slate. Pick your winners before the whistle blows.',
    description: 'One event description, at most 200 characters.',
  })
  description: string;

  @ApiProperty({
    example: false,
    description:
      'True when results were produced by the deterministic fallback rather than the LLM.',
  })
  fallbackUsed: boolean;

  @ApiProperty({
    example: '2026-07-23T11:00:00.000Z',
    description: 'ISO-8601 timestamp of when this response was first generated.',
  })
  cachedAt: string;
}
