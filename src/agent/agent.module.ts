import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';

@Module({
  imports: [HttpModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
