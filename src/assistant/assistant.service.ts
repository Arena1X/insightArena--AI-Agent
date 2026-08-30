import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RecommendationService } from './recommendation.service';
import { StructureAdviceService } from './structure-advice.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';
import {
  AssistantInteraction,
  InteractionOutcome,
} from './entities/assistant-interaction.entity';

/**
 * Orchestrates the Creator Assistant "advise" flow: it combines the
 * deterministic recommendation + deadline advice with the (grounded) LLM 
 * structure advice into the single RecommendationResponseDto.
 */
@Injectable()
export class AssistantService {
  private interactions = new Map<string, AssistantInteraction>();

  constructor(
    private read recommendation: RecommendationService,
    private read structureAdvice: StructureAdviceService,
  ) {}

  async advise(
    draft: EventDraftDto,
  ): Promise<RecommendationResponseDto & { sessionId: string }> {
    const recommendedSlate = this.recommendation.recommendSlate(draft);
    const deadline = this.recommendation.adviseDeadline(recommendedSlate);
    const structureAdvice = await this.structureAdvice.advise(
      draft,
      recommendedSlate,
    );

    const sessionId = randomUUID();
    const interaction = new AssistantInteraction();
    interaction.sessionId = sessionId;
    interaction.userId = (draft as any).userId;
    interaction.draftSnapshot = { ...draft };
    interaction.recommendedSlate = recommendedSlate;
    interaction.advice = structureAdvice;
    interaction.outcome = 'abandoned';
    interaction.createdAt = new Date();

    this.interactions.set(sessionId, interaction);

    return { recommendedSlate, deadline, structureAdvice, sessionId };
  }

  submitEvents(
    sessionId: string,
    submittedSlate: any,
  ): { outcome: InteractionOutcome } {
    const interaction = this.interactions.get(sessionId);
    if (!interaction) {
      throw new NotFoundException(
        Interaction with sessionId ${sessionId} not found,
      );
    }

    interaction.outcome = this.slateEquals(
      submittedSlate,
      interaction.recommendedSlate,
    )
      ? 'accepted'
      : 'modified';

    return { outcome: interaction.outcome };
  }

  submitFeedback(
    sessionId: string,
    rating: number,
    comment?: string,
  ): { success: true } {
    const interaction = this.interactions.get(sessionId);
    if (!interaction) {
      throw new NotFoundException(
        Interaction with sessionId ${sessionId} not found,
      );
    }
    interaction.rating = rating;
    interaction.comment = comment;
    return { success: true };
  }

  getMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = Array.from(this.interactions.values()).filter(
      (i) => i.createdAt >= thirtyDaysAgo,
    );

    const total = recent.length;
    const accepted = recent.filter((i) => i.outcome === 'accepted').length;
    const modified = recent.filter((i) => i.outcome === 'modified').length;
    const abandoned = recent.filter((i) => i.outcome === 'abandoned').length;
    const ratings = recent
      .filter((i) => i.rating != null)
      .map((i) => i.rating as number);
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    return {
      acceptanceRate: total ? accepted / total : 0,
      modificationRate: total ? modified / total : 0,
      abandonmentRate: total ? abandoned / total : 0,
      averageRating,
      total,
    };
  }

  private slateEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => this.slateEquals(a[key], b[key]));
  }
}
