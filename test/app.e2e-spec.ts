import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Agent API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const config = new DocumentBuilder()
      .setTitle('InsightArena AI Agent API')
      .setDescription('The AI Agent API for InsightArena Prediction Market')
      .setVersion('1.0')
      .addTag('agent')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/agent/status', () => {
    it('should return 200 and agent status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/agent/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('mode');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('healthy');
    });

    it('should return capabilities array', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/agent/status')
        .expect(200);

      expect(Array.isArray(response.body.capabilities)).toBe(true);
      expect(response.body.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/docs', () => {
    it('should return Swagger UI HTML', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/docs')
        .expect(200);

      expect(response.text).toContain('swagger');
      expect(response.text).toContain('Swagger UI');
    });
  });

  describe('GET /api/v1/docs-json', () => {
    it('should return OpenAPI JSON spec', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/docs-json')
        .expect(200);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
      expect(response.body.info.title).toContain('InsightArena');
    });
  });
});
