import { GoogleGenAI } from '@google/genai';
import { AIError, categorizeAIError } from './errors';
import {
  AIExecutionOptions,
  AIExecutionResult,
  AIProvider,
  TaskDefinition,
} from './types';

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  public readonly modelId: string;
  private readonly client: GoogleGenAI | null = null;
  private readonly apiKey: string | null = null;

  constructor(apiKey?: string, modelId?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;
    this.modelId = modelId || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public async executeTask<TInput, TOutput>(
    task: TaskDefinition<TInput, TOutput>,
    input: TInput,
    options?: AIExecutionOptions
  ): Promise<AIExecutionResult<TOutput>> {
    if (!this.client || !this.apiKey) {
      throw new AIError(
        'MISSING_API_KEY',
        'GEMINI_API_KEY is not configured on the server. Please configure it in your environment.',
        { status: 401 }
      );
    }

    const { systemPrompt, userPrompt } = task.buildPrompt(input);
    const timeoutMs = options?.timeoutMs || 45000;
    const maxRetries = options?.maxRetries ?? 1;

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= maxRetries) {
      attempt++;
      const startTime = Date.now();

      try {
        // Set up timeout controller
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            reject(
              new AIError('TIMEOUT', `Gemini request timed out after ${timeoutMs}ms`, {
                status: 504,
                isRetryable: true,
              })
            );
          }, timeoutMs);
          if (typeof timer.unref === 'function') timer.unref();
        });

        const executionPromise = (async () => {
          const response = await this.client!.models.generateContent({
            model: this.modelId,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });
          return response;
        })();

        const response = await Promise.race([executionPromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;

        const rawText = response.text || '';
        if (!rawText.trim()) {
          throw new AIError('INVALID_OUTPUT', 'Gemini returned an empty response', {
            isRetryable: true,
          });
        }

        let parsed: unknown;
        try {
          // Strip any accidental markdown formatting around json
          const cleanJson = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          parsed = JSON.parse(cleanJson);
        } catch (jsonErr) {
          throw new AIError('INVALID_OUTPUT', `Failed to parse Gemini JSON output: ${rawText.slice(0, 200)}`, {
            isRetryable: true,
            cause: jsonErr,
          });
        }

        const validated = task.validateOutput(parsed);

        const usage = response.usageMetadata;
        const tokensUsed = usage
          ? {
              promptTokens: usage.promptTokenCount,
              completionTokens: usage.candidatesTokenCount,
              totalTokens: usage.totalTokenCount,
            }
          : undefined;

        return {
          output: validated,
          provider: this.name,
          model: this.modelId,
          promptVersion: task.promptVersion,
          schemaVersion: task.schemaVersion,
          tokensUsed,
          latencyMs,
        };
      } catch (err) {
        lastError = err;
        const categorized = categorizeAIError(err);

        // If retryable and attempts remaining, retry after short backoff
        if (categorized.isRetryable && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        throw categorized;
      }
    }

    throw categorizeAIError(lastError);
  }
}
