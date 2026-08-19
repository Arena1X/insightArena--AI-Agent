import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as request from 'supertest';
import { createE2eApp } from './e2e/create-e2e-app';
import { E2E_TESTED_PATHS } from './e2e/tested-paths';

describe('Application e2e infrastructure', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI HTML', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/docs').expect(200);

    expect(response.text).toContain('Swagger UI');
  });

  it('serves the OpenAPI JSON specification', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/docs-json').expect(200);

    expect(response.body).toHaveProperty('openapi');
    expect(response.body.info.title).toContain('InsightArena');
  });

  it('has e2e coverage for every Swagger path', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('InsightArena AI Agent API')
        .setDescription('The AI Agent API for InsightArena Prediction Market')
        .setVersion('1.0')
        .addTag('agent')
        .addTag('assistant')
        .build(),
    );
    const swaggerPaths = Object.keys(document.paths).sort();

    expect(E2E_TESTED_PATHS.slice().sort()).toEqual(swaggerPaths);
  });
});
