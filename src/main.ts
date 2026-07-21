import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const config = new DocumentBuilder()
    .setTitle('InsightArena AI Agent API')
    .setDescription(
      'The AI Agent API for InsightArena Prediction Market. This service provides autonomous market analysis, AI-powered predictions, personalized user coaching, leaderboard insights, and oracle validation for the InsightArena platform.',
    )
    .setVersion('1.0')
    .setContact(
      'InsightArena Team',
      'https://insightarena.io',
      'dev@insightarena.io',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3001', 'Local development server')
    .addServer('https://api.insightarena.io', 'Production server')
    .addTag(
      'agent',
      'Core AI Agent endpoints for market analysis, predictions, and user coaching',
    )
    .addTag('health', 'Health check and monitoring endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your InsightArena API key (JWT token)',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      syntaxHighlight: {
        theme: 'monokai',
      },
    },
    customSiteTitle: 'InsightArena AI Agent - API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    customfavIcon: 'https://insightarena.io/favicon.ico',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/v1/docs`,
  );
}

bootstrap();
