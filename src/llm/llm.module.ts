import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

/**
 * Centralized LLM module providing OpenAI client with retry logic,
 * exponential backoff, and cost logging.
 *
 * Import this module in any feature module that needs LLM capabilities.
 * No other module should import 'openai' directly.
 */
@Module({
    providers: [LlmService],
    exports: [LlmService],
})
export class LlmModule { }
