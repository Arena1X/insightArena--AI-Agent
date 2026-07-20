import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface LlmCompletionOptions {
  system: string;
  user: string;
  /** Force JSON-object responses when the model/endpoint supports it. */
  json?: boolean;
  temperature?: number;
}

/**
 * Thin shared wrapper around the OpenAI chat completions API. All LLM-backed
 * features (Prediction Analyst, Leaderboard Coach, Creator Assistant) go
 * through this service so model config and error handling live in one place.
 *
 * Callers are expected to handle failures and provide their own fallbacks;
 * this service throws on any error rather than swallowing it.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY not set — LlmService will fail closed and callers must fall back.',
      );
    }
  }

  /** Whether the service is configured with credentials. */
  isConfigured(): boolean {
    return this.client != null;
  }

  /**
   * Runs a single chat completion and returns the raw assistant text.
   * Throws if the service is unconfigured or the API call fails.
   */
  async complete(options: LlmCompletionOptions): Promise<string> {
    if (!this.client) {
      throw new Error('LlmService is not configured (missing OPENAI_API_KEY)');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: options.temperature ?? 0.4,
      ...(options.json
        ? { response_format: { type: 'json_object' as const } }
        : {}),
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LlmService received an empty completion');
    }
    return content;
  }
}
