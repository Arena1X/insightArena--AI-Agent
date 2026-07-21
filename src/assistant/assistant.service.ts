import { Injectable } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { StructureAdviceService } from './structure-advice.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';

/**
 * Orchestrates the Creator Assistant "advise" flow: it combines the
 * deterministic recommendation + deadline advice with the (grounded) LLM
 * structure advice into the single RecommendationResponseDto.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly recommendation: RecommendationService,
    private readonly structureAdvice: StructureAdviceService,
  ) {}

  async advise(draft: EventDraftDto): Promise<RecommendationResponseDto> {
    const recommendedSlate = this.recommendation.recommendSlate(draft);
    const deadline = this.recommendation.adviseDeadline(recommendedSlate);
    const structureAdvice = await this.structureAdvice.advise(
      draft,
      recommendedSlate,
    );

    return { recommendedSlate, deadline, structureAdvice };
  }
}
