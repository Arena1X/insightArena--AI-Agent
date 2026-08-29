# LLM Service Module

Centralized LLM client service wrapping OpenAI API with retry logic, exponential backoff, cost logging, and JSON validation.

## Features

- ✅ **Retry Logic**: Automatic retry with exponential backoff on 429 (rate limit) and 5xx (server) errors
- ✅ **Smart Error Handling**: No retry on 4xx client errors (400, 401, 403, etc.)
- ✅ **JSON Mode**: Enforced JSON output with validation and reformulation retry
- ✅ **Cost Tracking**: Token usage and latency logging per call
- ✅ **Correlation-ID Aware**: Support for request correlation tracking
- ✅ **Configuration**: Centralized OpenAI client setup from environment variables

## Configuration

Set the following environment variables:

```env
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

## Usage

### Import the Module

```typescript
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [LlmModule],
  // ...
})
export class YourModule {}
```

### Basic Text Completion

```typescript
import { LlmService } from './llm/llm.service';

@Injectable()
export class YourService {
  constructor(private readonly llm: LlmService) {}

  async analyze(data: string): Promise<string> {
    return await this.llm.complete(
      `Analyze this data: ${data}`,
      {
        temperature: 0.7,
        correlationId: 'analysis-123',
      }
    );
  }
}
```

### JSON Output with Validation

```typescript
interface AnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keywords: string[];
}

async analyzeWithStructure(text: string): Promise<AnalysisResult> {
  return await this.llm.completeJson<AnalysisResult>(
    `Analyze the sentiment of this text: "${text}"`,
    '{ sentiment: "positive" | "negative" | "neutral", confidence: number, keywords: string[] }',
    { correlationId: 'sentiment-456' }
  );
}
```

## API Reference

### `complete(prompt, options?)`

Runs a single chat completion and returns the raw assistant text.

**Parameters:**
- `prompt` (string): The user prompt
- `options` (LlmCompletionOptions, optional):
  - `temperature` (number): Sampling temperature (default: 0.4)
  - `maxTokens` (number): Maximum tokens to generate
  - `correlationId` (string): Request tracking ID

**Returns:** `Promise<string>` - The completion text

**Throws:** 
- Error if service is not configured
- Error if API call fails (after retries for 429/5xx)

### `completeJson<T>(prompt, schemaDescription, options?)`

Runs a completion that expects JSON output and parses/validates it.

**Parameters:**
- `prompt` (string): The user prompt
- `schemaDescription` (string): Description of expected JSON structure
- `options` (LlmCompletionOptions, optional): Same as `complete()`

**Returns:** `Promise<T>` - Parsed JSON object

**Features:**
- Enforces JSON response format
- Performs one reformulation retry if the model returns malformed JSON
- Validates JSON parsing before returning

### `isConfigured()`

Checks if the service has valid credentials.

**Returns:** `boolean` - True if OPENAI_API_KEY is set

## Retry Behavior

### Retryable Errors (up to 3 attempts)
- **429 Rate Limit**: Retried with exponential backoff (1s, 2s, 4s)
- **5xx Server Errors**: Same retry behavior

### Non-Retryable Errors (immediate failure)
- **400 Bad Request**: Invalid request format
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Permission denied
- **404 Not Found**: Resource not found
- Other 4xx client errors

### JSON Reformulation
When using `completeJson()`, if the model returns malformed JSON:
1. First attempt with original prompt
2. If JSON parse fails → retry with reformulation prompt (1 time only)
3. If still malformed → throw error

Total attempts = network retries × JSON attempts = up to 6 API calls in worst case.

## Logging

The service logs the following metrics for each successful call:

```
[LlmService] LLM usage: model=gpt-4o-mini, tokens=150 (prompt=100, completion=50), latency=1234ms [correlation-id-123]
```

Warnings are logged for retries:
```
[LlmService] LLM request failed (attempt 1/3), retrying in 1000ms: Rate limit exceeded [correlation-id-123]
```

Errors are logged for failures:
```
[LlmService] LLM client error (no retry): Bad request [correlation-id-123]
```

## Testing

Run the test suite:

```bash
pnpm test src/llm/llm.service.spec.ts
```

The tests cover:
- ✅ Configuration validation
- ✅ Successful completions
- ✅ Retry on 429 with exponential backoff
- ✅ Retry on 500 server errors
- ✅ No retry on 400/401 errors
- ✅ JSON parsing and validation
- ✅ JSON reformulation retry
- ✅ Token usage logging
- ✅ Correlation ID handling

## Migration from Old Service

If you're migrating from `src/assistant/llm/llm.service.ts`:

### Old Code
```typescript
const response = await llmService.complete({
  system: 'You are a helpful assistant',
  user: 'What is 2+2?',
  json: true,
  temperature: 0.4,
});
```

### New Code
```typescript
// For text completion
const response = await llmService.complete(
  'You are a helpful assistant. What is 2+2?',
  { temperature: 0.4 }
);

// For JSON completion
const response = await llmService.completeJson(
  'You are a helpful assistant. What is 2+2? Respond with JSON.',
  '{ answer: number }',
  { temperature: 0.4 }
);
```

## Architecture Decision

This centralized LLM service ensures:

1. **No Direct OpenAI Imports**: Only `LlmService` imports `openai` - all other modules import `LlmService`
2. **Consistent Error Handling**: All LLM calls use the same retry logic
3. **Cost Visibility**: Token usage is logged for monitoring and budgeting
4. **Testability**: Mocking is centralized in one place
5. **Configuration**: One place to update API keys, models, or retry policies

## Important Notes

⚠️ **No other module should import `openai` directly** - always use `LlmService` instead.

✅ The service fails closed - if `OPENAI_API_KEY` is not set, all calls throw errors immediately.

✅ Callers should handle errors and provide their own fallbacks - this service throws on failures rather than swallowing them.
