import { ApiProperty } from '@nestjs/swagger';

export class PredictionResultDto {
  @ApiProperty({
    description: 'Unique identifier for this prediction',
    example: 'pred_xyz789abc',
  })
  predictionId: string;

  @ApiProperty({
    description: 'The market ID this prediction belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  marketId: string;

  @ApiProperty({
    description: 'The predicted outcome',
    example: 'team_a_win',
  })
  outcome: string;

  @ApiProperty({
    description: 'Confidence level for this prediction (0-100)',
    example: 85,
    type: Number,
  })
  confidence: number;

  @ApiProperty({
    description: 'Current status of the prediction',
    example: 'pending',
    enum: ['pending', 'settled_won', 'settled_lost'],
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp when the prediction was created',
    example: '2026-07-20T09:00:00Z',
  })
  createdAt: string;
}
