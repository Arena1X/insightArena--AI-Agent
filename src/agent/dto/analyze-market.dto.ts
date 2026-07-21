import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class AnalyzeMarketDto {
  @ApiProperty({
    description: 'The unique identifier of the market to analyze',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  marketId: string;

  @ApiPropertyOptional({
    description: 'Additional context or instructions for the analysis',
    example: 'Focus on recent team performance and head-to-head records',
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({
    description: 'Specific aspects to analyze',
    example: ['team_form', 'head_to_head', 'injuries'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aspects?: string[];
}
