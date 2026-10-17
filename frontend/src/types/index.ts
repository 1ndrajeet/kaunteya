export interface HealthResponse {
  status: "ok" | "degraded" | "error" | string;
  app: string;
  environment: string;
  timestamp: string;
  version?: string;
}

export interface RootResponse {
  message: string;
  docs_url: string;
  health_url: string;
}

export interface ApiErrorPayload {
  message: string;
  status: number;
  details?: unknown;
}
