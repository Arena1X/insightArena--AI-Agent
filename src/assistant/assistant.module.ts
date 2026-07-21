import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { RecommendationService } from './recommendation.service';
import { StructureAdviceService } from './structure-advice.service';
import { LlmService } from './llm/llm.service';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    RecommendationService,
    StructureAdviceService,
    LlmService,
  ],
  exports: [LlmService],
})
export class AssistantModule {}
