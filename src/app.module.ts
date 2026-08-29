import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentModule } from './agent/agent.module';
import { AssistantModule } from './assistant/assistant.module';
import { StellarModule } from './stellar/stellar.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LlmModule,
    AgentModule,
    AssistantModule,
    StellarModule,
  ],
})
export class AppModule { }
