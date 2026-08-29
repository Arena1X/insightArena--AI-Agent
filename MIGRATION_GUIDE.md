# Migration Guide: New LLM Service

## Quick Start

The new centralized LLM service is ready to use. Here's what you need to know:

## For New Features

Import and use the new service immediately:

```typescript
import { LlmModule } from './llm/llm.module';
import { LlmService } from './llm/llm.service';

// In your module
@Module({
  imports: [LlmModule],
  // ...
})

// In your service
@Injectable()
export class YourService {
  constructor(private readonly llm: LlmService) {}

  async yourMethod() {
    const result = await this.llm.complete('Your prompt here');
    return result;
  }
}
```

## For Existing Code

The old service at `src/assistant/llm/llm.service.ts` still works. You can migrate gradually:

### Old API
```typescript
const response = await llm.complete({
  system: 'You are a helpful assistant',
  user: 'What is 2+2?',
  json: false,
  temperature: 0.4,
});
```

### New API (Text)
```typescript
const response = await llm.complete(
  'You are a helpful assistant. What is 2+2?',
  { temperature: 0.4 }
);
```

### New API (JSON)
```typescript
const response = await llm.completeJson<{ answer: number }>(
  'You are a helpful assistant. What is 2+2?',
  '{ answer: number }',
  { temperature: 0.4 }
);
```

## Key Differences

| Feature | Old Service | New Service |
|---------|-------------|-------------|
| **System/User Messages** | Separate fields | Combined in prompt |
| **JSON Mode** | `json: true` flag | Separate `completeJson()` method |
| **Retry Logic** | None | Automatic with backoff |
| **Token Logging** | None | Automatic |
| **Correlation ID** | Not supported | `correlationId` option |
| **Error Handling** | Basic | Smart retry on 429/5xx |

## Benefits of New Service

1. **Automatic Retries**: No more manual retry logic in your code
2. **Cost Tracking**: Token usage logged for every call
3. **JSON Validation**: `completeJson()` ensures valid JSON with reformulation retry
4. **Better Monitoring**: Correlation IDs for request tracking
5. **Centralized Config**: One place to update API keys, models, retry policies

## Environment Variables

Update your `.env` file:

```env
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

## Testing

Mock the new service in tests:

```typescript
import { LlmService } from './llm/llm.service';

const mockLlmService = {
  isConfigured: jest.fn().mockReturnValue(true),
  complete: jest.fn().mockResolvedValue('Mock response'),
  completeJson: jest.fn().mockResolvedValue({ data: 'mock' }),
};

// In your test module
.overrideProvider(LlmService)
.useValue(mockLlmService)
```

## Gradual Migration Strategy

1. **Phase 1**: Use new service for all new features ✅ (ready now)
2. **Phase 2**: Migrate high-traffic endpoints for retry benefits
3. **Phase 3**: Update remaining services at your convenience
4. **Phase 4**: Deprecate old service (no rush - both work fine)

## Need Help?

- **Documentation**: See `src/llm/README.md`
- **Examples**: See `src/llm/llm.service.spec.ts` for usage patterns
- **Implementation**: See `LLM_SERVICE_IMPLEMENTATION.md` for details

## Important Notes

⚠️ **No Direct OpenAI Imports**: Always use `LlmService`, never import `openai` directly.

✅ **Backward Compatible**: Old service still works - migrate when ready.

🚀 **Production Ready**: All tests passing, retry logic verified, ready to use.
