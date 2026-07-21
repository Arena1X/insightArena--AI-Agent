import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('AgentService', () => {
  let service: AgentService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return healthy status', async () => {
      const result = await service.getStatus();
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('active');
    });

    it('should return all capability names', async () => {
      const result = await service.getStatus();
      const capabilityNames = result.capabilities.map((c) => c.name);
      expect(capabilityNames).toContain('prediction_analyst');
      expect(capabilityNames).toContain('market_creator');
      expect(capabilityNames).toContain('oracle_validator');
      expect(capabilityNames).toContain('leaderboard_coach');
      expect(capabilityNames).toContain('creator_assistant');
    });

    it('should have a valid timestamp', async () => {
      const result = await service.getStatus();
      const timestamp = new Date(result.timestamp);
      expect(timestamp instanceof Date).toBe(true);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });
});
