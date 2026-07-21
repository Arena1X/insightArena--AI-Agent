import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

/**
 * A single candidate or recommended fixture. Team names here form the
 * "slate" that the LLM structure advice is grounded against.
 */
export class FixtureDto {
  @ApiProperty({ example: 'fx_101', description: 'Unique fixture identifier' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Arsenal' })
  @IsString()
  homeTeam: string;

  @ApiProperty({ example: 'Chelsea' })
  @IsString()
  awayTeam: string;

  @ApiProperty({ example: 'Premier League', required: false })
  @IsOptional()
  @IsString()
  league?: string;

  @ApiProperty({
    example: '2026-07-25T15:00:00.000Z',
    description: 'Kickoff time in ISO-8601',
  })
  @IsISO8601()
  kickoffTime: string;
}
