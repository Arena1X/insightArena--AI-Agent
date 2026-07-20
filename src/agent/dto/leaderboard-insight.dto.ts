import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LeaderboardEntryDto {
  @ApiProperty({
    description: 'Rank position',
    example: 1,
    type: Number,
  })
  rank: number;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'Display name of the user',
    example: 'TraderJoe',
  })
  displayName: string;

  @ApiProperty({
    description: 'Total score',
    example: 9850,
    type: Number,
  })
  score: number;

  @ApiProperty({
    description: 'Number of correct predictions',
    example: 45,
    type: Number,
  })
  correctPredictions: number;

  @ApiProperty({
    description: 'Total predictions made',
    example: 60,
    type: Number,
  })
  totalPredictions: number;

  @ApiProperty({
    description: 'Accuracy percentage',
    example: 75.0,
    type: Number,
  })
  accuracy: number;

  @ApiProperty({
    description: 'Whether this is the queried user',
    example: false,
  })
  isCurrentUser: boolean;
}

export class LeaderboardInsightDto {
  @ApiProperty({
    description: 'The user ID these insights are for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'The leaderboard these insights are from',
    example: 'global',
  })
  leaderboardType: string;

  @ApiProperty({
    description: 'Current rank of the user',
    example: 15,
    type: Number,
  })
  currentRank: number;

  @ApiProperty({
    description: 'Total participants on the leaderboard',
    example: 250,
    type: Number,
  })
  totalParticipants: number;

  @ApiProperty({
    description: 'Recent rank trend',
    example: '+3',
  })
  rankTrend: string;

  @ApiPropertyOptional({
    description: 'List of top leaderboard entries',
    type: [LeaderboardEntryDto],
  })
  topEntries?: LeaderboardEntryDto[];

  @ApiProperty({
    description: 'Timestamp when the insight was generated',
    example: '2026-07-20T09:00:00Z',
  })
  generatedAt: string;
}
