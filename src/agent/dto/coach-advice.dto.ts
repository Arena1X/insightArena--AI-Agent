import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CoachAdviceRequestDto {
  @ApiProperty({
    description: 'The user ID to generate advice for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'Specific focus area for the advice',
    example: 'improve_accuracy',
    enum: ['improve_accuracy', 'risk_management', 'market_selection', 'general'],
  })
  @IsOptional()
  @IsString()
  focus?: string;
}

class PerformanceMetricDto {
  @ApiProperty({
    description: 'Metric name',
    example: 'overall_accuracy',
  })
  name: string;

  @ApiProperty({
    description: 'Value of the metric',
    example: 72.5,
    type: Number,
  })
  value: number;

  @ApiProperty({
    description: 'Unit or description',
    example: '%',
  })
  unit: string;
}

class AdviceItemDto {
  @ApiProperty({
    description: 'The advice message',
    example: 'Consider diversifying your predictions across more markets to reduce variance.',
  })
  message: string;

  @ApiProperty({
    description: 'Priority level of this advice',
    example: 'high',
    enum: ['low', 'medium', 'high'],
  })
  priority: string;

  @ApiPropertyOptional({
    description: 'Expected impact of following this advice',
    example: '+15% accuracy improvement',
  })
  impact?: string;
}

export class CoachAdviceResponseDto {
  @ApiProperty({
    description: 'The user ID the advice is for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'Performance metrics for the user',
    type: [PerformanceMetricDto],
  })
  metrics: PerformanceMetricDto[];

  @ApiProperty({
    description: 'Personalized advice items',
    type: [AdviceItemDto],
  })
  advice: AdviceItemDto[];

  @ApiProperty({
    description: 'Overall performance trend',
    example: 'improving',
    enum: ['improving', 'declining', 'stable'],
  })
  trend: string;

  @ApiProperty({
    description: 'Timestamp when the advice was generated',
    example: '2026-07-20T09:00:00Z',
  })
  generatedAt: string;
}
