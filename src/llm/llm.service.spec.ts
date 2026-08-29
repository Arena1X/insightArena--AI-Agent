import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import OpenAI from 'openai';

// Mock OpenAI module
jest.mock('openai');

describe('LlmService', () => {
    let service: LlmService;
    let mockOpenAIInstance: {
        chat: {
            completions: {
                create: jest.Mock;
            };
        };
    };

    const mockApiKey = 'sk-test-key-123';
    const mockModel = 'gpt-4o-mini';

    beforeEach(async () => {
        // Create mock instance that will be returned by OpenAI constructor
        mockOpenAIInstance = {
            chat: {
                completions: {
                    create: jest.fn(),
                },
            },
        };

        // Mock the OpenAI constructor
        (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
            () => mockOpenAIInstance as unknown as OpenAI,
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LlmService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'OPENAI_API_KEY') return mockApiKey;
                            if (key === 'LLM_MODEL') return mockModel;
                            return undefined;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<LlmService>(LlmService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isConfigured', () => {
        it('should return true when API key is provided', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when API key is missing', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    LlmService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => undefined),
                        },
                    },
                ],
            }).compile();

            const unconfiguredService = module.get<LlmService>(LlmService);
            expect(unconfiguredService.isConfigured()).toBe(false);
        });
    });

    describe('complete', () => {
        it('should successfully return completion text', async () => {
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: 'This is a test response',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            const result = await service.complete('Test prompt');

            expect(result).toBe('This is a test response');
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
                model: mockModel,
                temperature: 0.4,
                max_tokens: undefined,
                messages: [{ role: 'user', content: 'Test prompt' }],
            });
        });

        it('should use custom temperature when provided', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Response' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            await service.complete('Test', { temperature: 0.8 });

            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({ temperature: 0.8 }),
            );
        });

        it('should throw error when service is not configured', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    LlmService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => undefined),
                        },
                    },
                ],
            }).compile();

            const unconfiguredService = module.get<LlmService>(LlmService);

            await expect(unconfiguredService.complete('Test')).rejects.toThrow(
                'LlmService is not configured (missing OPENAI_API_KEY)',
            );
        });

        it('should throw error when completion is empty', async () => {
            mockOpenAIInstance.chat.completions.create.mockResolvedValue({
                choices: [{ message: { content: null } }],
                usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
            });

            await expect(service.complete('Test')).rejects.toThrow(
                'LlmService received an empty completion',
            );
        });

        it('should retry on 429 rate limit error with exponential backoff', async () => {
            const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
                status: 429,
            });

            const mockResponse = {
                choices: [{ message: { content: 'Success after retry' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
            };

            mockOpenAIInstance.chat.completions.create
                .mockRejectedValueOnce(rateLimitError)
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(mockResponse);

            const startTime = Date.now();
            const result = await service.complete('Test prompt');
            const elapsed = Date.now() - startTime;

            expect(result).toBe('Success after retry');
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                3,
            );
            // First retry: 1000ms, second retry: 2000ms = ~3000ms total minimum
            expect(elapsed).toBeGreaterThanOrEqual(3000);
        });

        it('should retry on 500 server error', async () => {
            const serverError = Object.assign(new Error('Internal server error'), {
                status: 500,
            });

            const mockResponse = {
                choices: [{ message: { content: 'Success after retry' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
            };

            mockOpenAIInstance.chat.completions.create
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce(mockResponse);

            const result = await service.complete('Test prompt');

            expect(result).toBe('Success after retry');
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                2,
            );
        });

        it('should NOT retry on 400 bad request error', async () => {
            const badRequestError = Object.assign(new Error('Bad request'), {
                status: 400,
            });

            mockOpenAIInstance.chat.completions.create.mockRejectedValue(
                badRequestError,
            );

            await expect(service.complete('Test prompt')).rejects.toThrow(
                'Bad request',
            );
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                1,
            );
        });

        it('should NOT retry on 401 unauthorized error', async () => {
            const unauthorizedError = Object.assign(new Error('Unauthorized'), {
                status: 401,
            });

            mockOpenAIInstance.chat.completions.create.mockRejectedValue(
                unauthorizedError,
            );

            await expect(service.complete('Test prompt')).rejects.toThrow(
                'Unauthorized',
            );
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                1,
            );
        });

        it('should fail after max retries on persistent 429 errors', async () => {
            const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
                status: 429,
            });

            mockOpenAIInstance.chat.completions.create.mockRejectedValue(
                rateLimitError,
            );

            await expect(service.complete('Test prompt')).rejects.toThrow(
                'Rate limit exceeded',
            );
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                3,
            );
        });

        it('should include correlation ID in options', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Response' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            await service.complete('Test', { correlationId: 'test-correlation-123' });

            // The correlation ID should be logged but not affect the API call
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalled();
        });
    });

    describe('completeJson', () => {
        it('should successfully parse and return JSON', async () => {
            const mockJsonResponse = { name: 'Test', value: 42 };
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: JSON.stringify(mockJsonResponse),
                        },
                    },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            const result = await service.completeJson<{ name: string; value: number }>(
                'Generate JSON',
                '{ name: string, value: number }',
            );

            expect(result).toEqual(mockJsonResponse);
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    response_format: { type: 'json_object' },
                }),
            );
        });

        it('should include schema description in prompt', async () => {
            const mockResponse = {
                choices: [{ message: { content: '{"test": true}' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            await service.completeJson(
                'Generate data',
                '{ test: boolean, count: number }',
            );

            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: [
                        {
                            role: 'user',
                            content: expect.stringContaining(
                                'Respond with valid JSON matching this structure: { test: boolean, count: number }',
                            ),
                        },
                    ],
                }),
            );
        });

        it('should retry once on malformed JSON then succeed', async () => {
            const malformedResponse = {
                choices: [{ message: { content: 'Not valid JSON at all' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            const validResponse = {
                choices: [{ message: { content: '{"status": "fixed"}' } }],
                usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
            };

            mockOpenAIInstance.chat.completions.create
                .mockResolvedValueOnce(malformedResponse)
                .mockResolvedValueOnce(validResponse);

            const result = await service.completeJson<{ status: string }>(
                'Generate JSON',
                '{ status: string }',
            );

            expect(result).toEqual({ status: 'fixed' });
            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                2,
            );

            // Second call should mention reformulation
            const secondCall =
                mockOpenAIInstance.chat.completions.create.mock.calls[1][0];
            expect(secondCall.messages[0].content).toContain(
                'The previous response was not valid JSON',
            );
        });

        it('should fail after one reformulation retry on persistent malformed JSON', async () => {
            const malformedResponse = {
                choices: [{ message: { content: 'Still not valid JSON' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                malformedResponse,
            );

            await expect(
                service.completeJson('Generate JSON', '{ test: boolean }'),
            ).rejects.toThrow('Failed to parse JSON after reformulation retry');

            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                2,
            );
        });

        it('should handle network retries before JSON reformulation', async () => {
            const rateLimitError = Object.assign(new Error('Rate limit'), {
                status: 429,
            });

            const validResponse = {
                choices: [{ message: { content: '{"success": true}' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(validResponse);

            const result = await service.completeJson<{ success: boolean }>(
                'Generate',
                '{ success: boolean }',
            );

            expect(result).toEqual({ success: true });
        });

        it('should NOT retry on 400 error in JSON mode', async () => {
            const badRequestError = Object.assign(new Error('Bad request'), {
                status: 400,
            });

            mockOpenAIInstance.chat.completions.create.mockRejectedValue(
                badRequestError,
            );

            await expect(
                service.completeJson('Generate', '{ test: boolean }'),
            ).rejects.toThrow('Bad request');

            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(
                1,
            );
        });

        it('should throw error when service is not configured', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    LlmService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn(() => undefined),
                        },
                    },
                ],
            }).compile();

            const unconfiguredService = module.get<LlmService>(LlmService);

            await expect(
                unconfiguredService.completeJson('Test', 'schema'),
            ).rejects.toThrow(
                'LlmService is not configured (missing OPENAI_API_KEY)',
            );
        });

        it('should handle correlation ID in JSON mode', async () => {
            const mockResponse = {
                choices: [{ message: { content: '{"data": "test"}' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            await service.completeJson('Generate', 'schema', {
                correlationId: 'json-test-456',
            });

            expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalled();
        });
    });

    describe('token usage logging', () => {
        it('should log token usage metrics on successful completion', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Response' } }],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 50,
                    total_tokens: 150,
                },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            const logSpy = jest.spyOn(service['logger'], 'log');

            await service.complete('Test prompt');

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('tokens=150'),
            );
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('prompt=100'),
            );
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('completion=50'),
            );
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('latency='));
        });

        it('should log correlation ID when provided', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            };

            mockOpenAIInstance.chat.completions.create.mockResolvedValue(
                mockResponse,
            );

            const logSpy = jest.spyOn(service['logger'], 'log');

            await service.complete('Test', { correlationId: 'correlation-xyz' });

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('[correlation-xyz]'),
            );
        });
    });

    describe('exponential backoff calculation', () => {
        it('should calculate correct backoff delays', () => {
            // Access private method via type assertion for testing
            const calculateBackoff = (service as any).calculateBackoff.bind(service);

            expect(calculateBackoff(0)).toBe(1000); // 1s
            expect(calculateBackoff(1)).toBe(2000); // 2s
            expect(calculateBackoff(2)).toBe(4000); // 4s
        });
    });
});
