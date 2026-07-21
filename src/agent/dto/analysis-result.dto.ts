import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalysisFactorDto {
  @ApiProperty({
    description: 'Name of the analysis factor',
    example: 'team_form',
  })
  name: string;

  @ApiProperty({
    description: 'Assessment of this factor',
    example: 'Team A has won 5 of their last 6 matches',
  })
  assessment: string;

  @ApiPropertyOptional({
    description: 'Weight/importance of this factor (0-1)',
    example: 0.8,
    type: Number,
  })
  weight?: number;
}

export class AnalysisResultDto {
  @ApiProperty({
    description: 'Unique identifier for this analysis',
    example: 'ana_abc123def456',
  })
  analysisId: string;

  @ApiProperty({
    description: 'The analyzed market ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  marketId: string;

  @ApiProperty({
    description: 'Confidence score for the market (0-100)',
    example: 85,
    type: Number,
  })
  confidence: number;

  @ApiProperty({
    description: 'Detailed reasoning from the AI analysis',
    example: 'Based on current form and historical data, Team A has a strong advantage...',
  })
  reasoning: string;

  @ApiProperty({
    description: 'Recommended prediction outcome',
    example: 'team_a_win',
  })
  recommendation: string;

  @ApiProperty({
    description: 'List of factors considered in the analysis',
    type: [AnalysisFactorDto],
  })
  factors: AnalysisFactorDto[];

  @ApiPropertyOptional({
    description: 'Risk level associated with this prediction',
    example: 'medium',
    enum: ['low', 'medium', 'high'],
  })
  riskLevel?: string;

  @ApiProperty({
    description: 'Timestamp when the analysis was performed',
    example: '2026-07-20T09:00:00Z',
  })
  analyzedAt: string;
}
