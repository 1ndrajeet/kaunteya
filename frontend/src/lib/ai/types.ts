export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface AIExecutionResult<TOutput> {
  output: TOutput;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  tokensUsed?: TokenUsage;
  latencyMs: number;
}

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export interface TaskDefinition<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  buildPrompt(input: TInput): PromptPayload;
  validateOutput(raw: unknown): TOutput;
}

export interface AIProvider {
  readonly name: string;
  readonly modelId: string;
  executeTask<TInput, TOutput>(
    task: TaskDefinition<TInput, TOutput>,
    input: TInput,
    options?: AIExecutionOptions
  ): Promise<AIExecutionResult<TOutput>>;
}
