import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  AnalyzeMarketDto,
  CreatePredictionDto,
  CoachAdviceRequestDto,
} from './dto';

describe('AgentController', () => {
  let controller: AgentController;
  let service: AgentService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        AgentService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    service = module.get<AgentService>(AgentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return agent status', async () => {
      const result = await controller.getStatus();
      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('active');
      expect(result.capabilities).toBeInstanceOf(Array);
      expect(result.capabilities.length).toBeGreaterThan(0);
    });

    it('should include uptime as a positive number', async () => {
      const result = await controller.getStatus();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyze', () => {
    it('should throw NotImplementedException', async () => {
      const dto: AnalyzeMarketDto = {
        marketId: '550e8400-e29b-41d4-a716-446655440000',
      };
      await expect(controller.analyze(dto)).rejects.toThrow();
    });
  });

  describe('predict', () => {
    it('should throw NotImplementedException', async () => {
      const dto: CreatePredictionDto = {
        marketId: '550e8400-e29b-41d4-a716-446655440000',
        outcome: 'team_a_win',
      };
      await expect(controller.predict(dto)).rejects.toThrow();
    });
  });

  describe('coach', () => {
    it('should throw NotImplementedException', async () => {
      const dto: CoachAdviceRequestDto = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
      };
      await expect(controller.coach(dto)).rejects.toThrow();
    });
  });

  describe('getLeaderboardInsights', () => {
    it('should throw NotImplementedException', async () => {
      await expect(
        controller.getLeaderboardInsights(
          '550e8400-e29b-41d4-a716-446655440000',
          'global',
          10,
        ),
      ).rejects.toThrow();
    });
  });
});
