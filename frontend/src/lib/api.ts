import type { HealthResponse } from "@/types";

export class ApiClientError extends Error {
  public status: number;
  public statusText: string;
  public data?: unknown;

  constructor(message: string, status: number, statusText: string, data?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/**
 * Resolves the backend base URL with fallback to the local default.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

/**
 * Typed HTTP fetch wrapper for communicating with the backend API.
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const targetUrl =
    endpoint.startsWith("http://") || endpoint.startsWith("https://")
      ? endpoint
      : `${baseUrl}${normalizedEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Automatically attach application/json for non-FormData payloads
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Network request failed";
    throw new ApiClientError(
      `Unable to reach API server at ${baseUrl} (${errorMsg})`,
      0,
      "NETWORK_ERROR",
    );
  }

  // Handle empty responses
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    if (!response.ok) {
      throw new ApiClientError(
        `Request failed with status ${response.status}`,
        response.status,
        response.statusText,
      );
    }
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let errorDetails: unknown = null;
    let errorMessage = `API error ${response.status}: ${response.statusText}`;

    try {
      if (isJson) {
        errorDetails = await response.json();
        if (
          typeof errorDetails === "object" &&
          errorDetails !== null &&
          "detail" in errorDetails &&
          typeof (errorDetails as { detail: unknown }).detail === "string"
        ) {
          errorMessage = (errorDetails as { detail: string }).detail;
        } else if (
          typeof errorDetails === "object" &&
          errorDetails !== null &&
          "message" in errorDetails &&
          typeof (errorDetails as { message: unknown }).message === "string"
        ) {
          errorMessage = (errorDetails as { message: string }).message;
        }
      } else {
        const text = await response.text();
        if (text) {
          errorDetails = text;
          errorMessage = text.length > 200 ? `${text.slice(0, 200)}...` : text;
        }
      }
    } catch {
      // Fallback to default message
    }

    throw new ApiClientError(errorMessage, response.status, response.statusText, errorDetails);
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

/**
 * Helper to check backend health status.
 */
export async function getBackendHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", {
    cache: "no-store",
  });
}
