import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, marketId, userId } from './create-e2e-app';
import {
  loadSeededDatabaseFixture,
  rollbackSeededDatabaseFixture,
} from './seeded-database.fixture';

describe('Agent endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await loadSeededDatabaseFixture();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
    await rollbackSeededDatabaseFixture();
  });

  it('POST /api/v1/agent/analyze accepts a valid market analysis request', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/agent/analyze')
      .send({ marketId, context: 'Use seeded predictions.', aspects: ['team_form'] })
      .expect(200);

    expect(body).toMatchObject({ marketId, recommendation: 'team_a_win' });
  });

  it('POST /api/v1/agent/analyze rejects validation failures with the standard error shape', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/agent/analyze')
      .send({ marketId: 'not-a-uuid' })
      .expect(400);

    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/agent/analyze',
    });
    expect(body).toHaveProperty('timestamp');
    expect(body.details).toContain('marketId must be a UUID');
  });

  it('POST /api/v1/agent/predict creates a prediction', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/agent/predict')
      .send({ marketId, outcome: 'team_a_win', stake: 25 })
      .expect(201);

    expect(body).toMatchObject({ predictionId: 'pred_e2e_001', marketId, status: 'pending' });
  });

  it('POST /api/v1/agent/coach returns seeded coaching advice', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/agent/coach')
      .send({ userId, focus: 'general' })
      .expect(200);

    expect(body).toMatchObject({ userId, trend: 'improving' });
  });

  it('GET /api/v1/agent/leaderboard/:userId returns leaderboard insight', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/agent/leaderboard/${userId}?type=weekly&limit=5`)
      .expect(200);

    expect(body).toMatchObject({ userId, leaderboardType: 'weekly', currentRank: 3 });
  });

  it('GET /api/v1/agent/status returns health', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/v1/agent/status').expect(200);
    expect(body.status).toBe('healthy');
  });
});

describe('Agent endpoint induced failures (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp((builder, { agentService }) => {
      agentService.analyzeMarket.mockRejectedValue(
        new ServiceUnavailableException('LLM unavailable'),
      );
    });
  });

  afterAll(async () => app.close());

  it('returns the standard error shape when a provider fails', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/agent/analyze')
      .send({ marketId })
      .expect(503);

    expect(body).toMatchObject({
      statusCode: 503,
      message: 'LLM unavailable',
      error: 'Service Unavailable',
      path: '/api/v1/agent/analyze',
    });
    expect(body).toHaveProperty('timestamp');
  });
});
