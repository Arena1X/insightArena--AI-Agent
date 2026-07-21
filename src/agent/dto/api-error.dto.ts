import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
    type: Number,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid market ID provided',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;

  @ApiPropertyOptional({
    description: 'Validation errors if applicable',
    example: ['marketId must be a UUID'],
    type: [String],
  })
  details?: string[];

  @ApiProperty({
    description: 'Timestamp when the error occurred',
    example: '2026-07-20T09:00:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that caused the error',
    example: '/api/v1/agent/analyze',
  })
  path: string;
}
