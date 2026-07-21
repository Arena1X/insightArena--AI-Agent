import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CapabilityStatusDto {
  @ApiProperty({
    description: 'Name of the capability',
    example: 'prediction_analyst',
  })
  name: string;

  @ApiProperty({
    description: 'Whether the capability is operational',
    example: true,
  })
  operational: boolean;

  @ApiPropertyOptional({
    description: 'Message about the capability status',
    example: 'OpenAI API connected and ready',
  })
  message?: string;
}

export class AgentStatusDto {
  @ApiProperty({
    description: 'Overall agent operational status',
    example: 'healthy',
    enum: ['healthy', 'degraded', 'down'],
  })
  status: string;

  @ApiProperty({
    description: 'Current agent mode',
    example: 'active',
    enum: ['active', 'idle', 'maintenance'],
  })
  mode: string;

  @ApiProperty({
    description: 'Uptime of the agent in seconds',
    example: 86400,
    type: Number,
  })
  uptime: number;

  @ApiProperty({
    description: 'AI model currently being used',
    example: 'gpt-4',
  })
  model: string;

  @ApiProperty({
    description: 'Status of each agent capability',
    type: [CapabilityStatusDto],
  })
  capabilities: CapabilityStatusDto[];

  @ApiProperty({
    description: 'Timestamp of the status check',
    example: '2026-07-20T09:00:00Z',
  })
  timestamp: string;
}
