import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './create-e2e-app';
import {
  loadSeededDatabaseFixture,
  rollbackSeededDatabaseFixture,
} from './seeded-database.fixture';

const draft = {
  title: 'Friday Night Footy',
  visibility: 'private',
  expectedParticipants: 12,
  desiredFixtureCount: 2,
  candidateFixtures: [
    {
      id: 'fx_1',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      league: 'Premier League',
      kickoffTime: '2026-07-25T15:00:00.000Z',
    },
    {
      id: 'fx_2',
      homeTeam: 'Liverpool',
      awayTeam: 'Everton',
      league: 'Premier League',
      kickoffTime: '2026-07-25T17:30:00.000Z',
    },
  ],
};

describe('Assistant endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await loadSeededDatabaseFixture();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
    await rollbackSeededDatabaseFixture();
  });

  it('POST /api/v1/assistant/advise returns recommendations and grounded advice', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/assistant/advise')
      .send(draft)
      .expect(201);

    expect(body.recommendedSlate).toHaveLength(2);
    expect(body.deadline.suggestedDeadline).toBe('2026-07-25T14:00:00.000Z');
    expect(body.structureAdvice.fallbackUsed).toBe(false);
  });

  it('POST /api/v1/assistant/advise rejects invalid drafts', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/assistant/advise')
      .send({ ...draft, candidateFixtures: [] })
      .expect(400);

    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/assistant/advise',
    });
  });

  it('POST /api/v1/assistant/naming returns generated names', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/assistant/naming')
      .send({ slateSummary: 'Arsenal vs Chelsea, Liverpool vs Everton', context: 'friends league' })
      .expect(201);

    expect(body.titles).toHaveLength(3);
    expect(body.description).toBeTruthy();
    expect(body.fallbackUsed).toBe(false);
  });

  it('POST /api/v1/assistant/naming rejects invalid requests', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/v1/assistant/naming')
      .send({ slateSummary: 'x'.repeat(501) })
      .expect(400);

    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/assistant/naming',
    });
  });
});
