import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // Agent endpoints will be implemented as issues
}
