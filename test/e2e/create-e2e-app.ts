import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';
import { AgentService } from '../../src/agent/agent.service';
import { LlmService } from '../../src/assistant/llm/llm.service';
import { SorobanService } from '../../src/stellar/soroban.service';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';

export const fixedDate = '2026-07-20T09:00:00.000Z';
export const marketId = '550e8400-e29b-41d4-a716-446655440000';
export const userId = '550e8400-e29b-41d4-a716-446655440001';

export function createAgentServiceMock() {
  return {
    analyzeMarket: jest.fn(async (dto) => ({
      analysisId: 'ana_e2e_001',
      marketId: dto.marketId,
      confidence: 82,
      reasoning: 'Seeded market form supports the requested outcome.',
      recommendation: 'team_a_win',
      factors: [{ name: 'seeded_form', assessment: 'Team A is trending up.', weight: 0.7 }],
      riskLevel: 'medium',
      analyzedAt: fixedDate,
    })),
    createPrediction: jest.fn(async (dto) => ({
      predictionId: 'pred_e2e_001',
      marketId: dto.marketId,
      outcome: dto.outcome,
      confidence: 78,
      status: 'pending',
      createdAt: fixedDate,
    })),
    getStatus: jest.fn(async () => ({
      status: 'healthy',
      mode: 'active',
      uptime: 42,
      model: 'mock-llm',
      capabilities: [{ name: 'prediction_analyst', operational: true, message: 'Mocked' }],
      timestamp: fixedDate,
    })),
    getCoachAdvice: jest.fn(async (dto) => ({
      userId: dto.userId,
      metrics: [{ name: 'overall_accuracy', value: 72.5, unit: '%' }],
      advice: [{ message: 'Keep using seeded audit history.', priority: 'medium', impact: '+5%' }],
      trend: 'improving',
      generatedAt: fixedDate,
    })),
    getLeaderboardInsights: jest.fn(async (requestedUserId, type = 'global') => ({
      userId: requestedUserId,
      leaderboardType: type,
      currentRank: 3,
      totalParticipants: 24,
      rankTrend: '+2',
      topEntries: [],
      generatedAt: fixedDate,
    })),
  };
}

export function createLlmServiceMock() {
  return {
    isConfigured: () => true,
    complete: jest.fn(async () =>
      JSON.stringify({
        scoringSuggestion: 'Award 3 points for an exact score, 1 for the result.',
        roundStructure: 'A single round resolved on match day.',
        engagementTips: ['Hype the Arsenal fixture as the headline match.'],
        titleSuggestions: ['Friday Night Showdown', 'Derby Drama'],
        titles: ['Derby Night', 'London Clash', 'Football Frenzy'],
        description: 'A compact slate of rivalry fixtures for sharp predictors.',
      }),
    ),
  };
}

export async function createE2eApp(
  configure?: (
    builder: TestingModuleBuilder,
    mocks: {
      agentService: ReturnType<typeof createAgentServiceMock>;
      llmService: ReturnType<typeof createLlmServiceMock>;
    },
  ) => void,
): Promise<INestApplication> {
  const agentService = createAgentServiceMock();
  const llmService = createLlmServiceMock();
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AgentService)
    .useValue(agentService)
    .overrideProvider(LlmService)
    .useValue(llmService)
    .overrideProvider(SorobanService)
    .useValue({ isConfigured: () => true, resolveMarket: jest.fn() });

  configure?.(builder, { agentService, llmService });

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('InsightArena AI Agent API')
      .setDescription('The AI Agent API for InsightArena Prediction Market')
      .setVersion('1.0')
      .addTag('agent')
      .addTag('assistant')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build(),
  );
  SwaggerModule.setup('api/v1/docs', app, document);
  await app.init();
  return app;
}
