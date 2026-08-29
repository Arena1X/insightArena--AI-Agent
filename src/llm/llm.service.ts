import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface LlmCompletionOptions {
    temperature?: number;
    maxTokens?: number;
    correlationId?: string;
}

export interface LlmUsageMetrics {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    model: string;
    correlationId?: string;
}

/**
 * Centralized LLM service wrapping OpenAI client with retry logic, backoff,
 * cost logging, and JSON validation.
 *
 * Features:
 * - Exponential backoff on 429/5xx errors (up to 3 attempts)
 * - No retry on 400/401 errors
 * - JSON output validation with reformulation retry
 * - Token usage and latency logging per call
 * - Correlation-ID aware logging
 */
@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private readonly client: OpenAI | null;
    private readonly model: string;
    private readonly maxRetries = 3;
    private readonly baseDelayMs = 1000;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('OPENAI_API_KEY');
        this.model = this.config.get<string>('LLM_MODEL') ?? 'gpt-4o-mini';
        this.client = apiKey ? new OpenAI({ apiKey, maxRetries: 0 }) : null;

        if (!this.client) {
            this.logger.warn(
                'OPENAI_API_KEY not set — LlmService will fail closed and callers must handle failures.',
            );
        }
    }

    /**
     * Whether the service is configured with credentials.
     */
    isConfigured(): boolean {
        return this.client != null;
    }

    /**
     * Runs a single chat completion and returns the raw assistant text.
     * Retries on 429/5xx with exponential backoff (up to 3 attempts).
     * Throws immediately on 400/401 errors.
     * Logs token usage and latency per call.
     *
     * @param prompt - The user prompt
     * @param options - Optional configuration (temperature, maxTokens, correlationId)
     * @returns The completion text
     */
    async complete(
        prompt: string,
        options?: LlmCompletionOptions,
    ): Promise<string> {
        if (!this.client) {
            throw new Error('LlmService is not configured (missing OPENAI_API_KEY)');
        }

        const startTime = Date.now();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    temperature: options?.temperature ?? 0.4,
                    max_tokens: options?.maxTokens,
                    messages: [{ role: 'user', content: prompt }],
                });

                const content = response.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error('LlmService received an empty completion');
                }

                const latencyMs = Date.now() - startTime;
                this.logUsage({
                    promptTokens: response.usage?.prompt_tokens ?? 0,
                    completionTokens: response.usage?.completion_tokens ?? 0,
                    totalTokens: response.usage?.total_tokens ?? 0,
                    latencyMs,
                    model: this.model,
                    correlationId: options?.correlationId,
                });

                return content;
            } catch (error) {
                lastError = error as Error;

                // Retry on rate limit (429) or server errors (5xx)
                if (this.isRetryableError(error)) {
                    const isLastAttempt = attempt === this.maxRetries - 1;
                    if (isLastAttempt) {
                        this.logger.error(
                            `LLM request failed after ${this.maxRetries} attempts: ${lastError.message}`,
                            options?.correlationId ? `[${options.correlationId}]` : '',
                        );
                        throw lastError;
                    }

                    const delayMs = this.calculateBackoff(attempt);
                    this.logger.warn(
                        `LLM request failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delayMs}ms: ${lastError.message}`,
                        options?.correlationId ? `[${options.correlationId}]` : '',
                    );
                    await this.sleep(delayMs);
                    continue;
                }

                // Don't retry on client errors (400, 401, 403, 404, etc.)
                if (this.isClientError(error)) {
                    this.logger.error(
                        `LLM client error (no retry): ${lastError.message}`,
                        options?.correlationId ? `[${options.correlationId}]` : '',
                    );
                    throw lastError;
                }

                // Unknown error - throw immediately
                this.logger.error(
                    `LLM request failed with unexpected error: ${lastError.message}`,
                    options?.correlationId ? `[${options.correlationId}]` : '',
                );
                throw lastError;
            }
        }

        // Should never reach here, but TypeScript needs it
        throw lastError || new Error('LLM request failed');
    }

    /**
     * Runs a completion that expects JSON output and parses/validates it.
     * Enforces JSON response format and performs one reformulation retry
     * if the model returns malformed JSON.
     *
     * @param prompt - The user prompt (should request JSON output)
     * @param schemaDescription - Description of expected JSON structure for validation
     * @param options - Optional configuration
     * @returns Parsed JSON object of type T
     */
    async completeJson<T = unknown>(
        prompt: string,
        schemaDescription: string,
        options?: LlmCompletionOptions,
    ): Promise<T> {
        if (!this.client) {
            throw new Error('LlmService is not configured (missing OPENAI_API_KEY)');
        }

        const startTime = Date.now();
        let lastError: Error | null = null;
        let rawResponse: string | null = null;

        // Try up to 2 times: initial attempt + 1 reformulation retry
        for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt++) {
            for (let networkAttempt = 0; networkAttempt < this.maxRetries; networkAttempt++) {
                try {
                    const enhancedPrompt =
                        jsonAttempt === 0
                            ? `${prompt}\n\nRespond with valid JSON matching this structure: ${schemaDescription}`
                            : `The previous response was not valid JSON. Please provide a valid JSON response matching this structure: ${schemaDescription}\n\nOriginal request: ${prompt}`;

                    const response = await this.client.chat.completions.create({
                        model: this.model,
                        temperature: options?.temperature ?? 0.4,
                        max_tokens: options?.maxTokens,
                        response_format: { type: 'json_object' },
                        messages: [{ role: 'user', content: enhancedPrompt }],
                    });

                    const content = response.choices?.[0]?.message?.content;
                    if (!content) {
                        throw new Error('LlmService received an empty completion');
                    }

                    rawResponse = content;

                    // Try to parse JSON
                    let parsed: T;
                    try {
                        parsed = JSON.parse(content) as T;
                    } catch (parseError) {
                        if (jsonAttempt === 0) {
                            // First JSON parse failure - break inner loop to retry with reformulation
                            this.logger.warn(
                                `JSON parse failed on attempt ${jsonAttempt + 1}/2, will reformulate`,
                                options?.correlationId ? `[${options.correlationId}]` : '',
                            );
                            break; // Break out of network retry loop to reformulation retry
                        } else {
                            // Second JSON parse failure - give up
                            throw new Error(
                                `Failed to parse JSON after reformulation retry: ${(parseError as Error).message}`,
                            );
                        }
                    }

                    // Success - log usage and return
                    const latencyMs = Date.now() - startTime;
                    this.logUsage({
                        promptTokens: response.usage?.prompt_tokens ?? 0,
                        completionTokens: response.usage?.completion_tokens ?? 0,
                        totalTokens: response.usage?.total_tokens ?? 0,
                        latencyMs,
                        model: this.model,
                        correlationId: options?.correlationId,
                    });

                    return parsed;
                } catch (error) {
                    lastError = error as Error;

                    // If it's a JSON parse error and not the last attempt, continue to reformulation
                    if (
                        lastError.message.includes('Failed to parse JSON') &&
                        jsonAttempt === 0
                    ) {
                        break; // Break to outer loop for reformulation
                    }

                    // Handle network errors with retry logic - check retryable first (429, 5xx)
                    if (this.isRetryableError(error)) {
                        const isLastNetworkAttempt =
                            networkAttempt === this.maxRetries - 1;
                        if (isLastNetworkAttempt) {
                            if (jsonAttempt === 0) {
                                // Try reformulation before giving up
                                break;
                            }
                            this.logger.error(
                                `LLM JSON request failed after ${this.maxRetries} network attempts and reformulation`,
                                options?.correlationId ? `[${options.correlationId}]` : '',
                            );
                            throw lastError;
                        }

                        const delayMs = this.calculateBackoff(networkAttempt);
                        this.logger.warn(
                            `LLM JSON request failed (attempt ${networkAttempt + 1}/${this.maxRetries}), retrying in ${delayMs}ms`,
                            options?.correlationId ? `[${options.correlationId}]` : '',
                        );
                        await this.sleep(delayMs);
                        continue;
                    }

                    // Don't retry on client errors (400, 401, etc.)
                    if (this.isClientError(error)) {
                        this.logger.error(
                            `LLM client error (no retry): ${lastError.message}`,
                            options?.correlationId ? `[${options.correlationId}]` : '',
                        );
                        throw lastError;
                    }

                    throw lastError;
                }
            }
        }

        throw (
            lastError ||
            new Error('LLM JSON request failed after all retry attempts')
        );
    }

    /**
     * Logs token usage metrics for monitoring and cost tracking.
     */
    private logUsage(metrics: LlmUsageMetrics): void {
        const logContext = metrics.correlationId
            ? `[${metrics.correlationId}]`
            : '';

        this.logger.log(
            `LLM usage: model=${metrics.model}, ` +
            `tokens=${metrics.totalTokens} (prompt=${metrics.promptTokens}, completion=${metrics.completionTokens}), ` +
            `latency=${metrics.latencyMs}ms ${logContext}`,
        );
    }

    /**
     * Determines if an error is a client error (4xx) that should not be retried.
     */
    private isClientError(error: unknown): boolean {
        if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            return status !== undefined && status >= 400 && status < 500;
        }
        return false;
    }

    /**
     * Determines if an error is retryable (429 rate limit or 5xx server error).
     */
    private isRetryableError(error: unknown): boolean {
        if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            return status === 429 || (status !== undefined && status >= 500);
        }
        return false;
    }

    /**
     * Calculates exponential backoff delay.
     */
    private calculateBackoff(attempt: number): number {
        return this.baseDelayMs * Math.pow(2, attempt);
    }

    /**
     * Sleep utility for retry delays.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
