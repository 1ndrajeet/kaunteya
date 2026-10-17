export type AIErrorCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'PROVIDER_ERROR'
  | 'TASK_NOT_FOUND';

export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly status?: number;
  public readonly isRetryable: boolean;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: { status?: number; isRetryable?: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = options?.status;
    this.isRetryable = options?.isRetryable ?? false;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export function categorizeAIError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('GEMINI_API_KEY') || message.includes('API key')) {
    return new AIError('MISSING_API_KEY', 'Gemini API key is not configured or invalid.', {
      status: 401,
      isRetryable: false,
      cause: error,
    });
  }

  if (message.includes('429') || message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('quota')) {
    return new AIError('RATE_LIMITED', 'Gemini rate limit exceeded. Please try again shortly.', {
      status: 429,
      isRetryable: true,
      cause: error,
    });
  }

  if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('deadline')) {
    return new AIError('TIMEOUT', 'AI request timed out.', {
      status: 504,
      isRetryable: true,
      cause: error,
    });
  }

  return new AIError('PROVIDER_ERROR', `AI provider error: ${message}`, {
    status: 500,
    isRetryable: false,
    cause: error,
  });
}
