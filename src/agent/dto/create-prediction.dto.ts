import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber } from 'class-validator';

export class CreatePredictionDto {
  @ApiProperty({
    description: 'The unique identifier of the market to predict on',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  marketId: string;

  @ApiProperty({
    description: 'The predicted outcome',
    example: 'team_a_win',
  })
  @IsString()
  outcome: string;

  @ApiPropertyOptional({
    description: 'Amount of tokens to stake on this prediction',
    example: 100,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  stake?: number;

  @ApiPropertyOptional({
    description: 'Analysis ID if using a pre-computed analysis',
    example: 'ana_abc123def456',
  })
  @IsOptional()
  @IsString()
  analysisId?: string;
}
