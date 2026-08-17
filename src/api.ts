import { REQUEST_TIMEOUT_MS } from "./config.js";

export interface ApiClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Injectable for tests; defaults to the global fetch. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

/** A non-2xx response from the API. `body` is the parsed RFC 9457 problem document when present. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(problemMessage(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function problemMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const problem = body as Record<string, unknown>;
    const detail = typeof problem.detail === "string" ? problem.detail : null;
    const title = typeof problem.title === "string" ? problem.title : null;
    if (detail) return `${status}: ${detail}`;
    if (title) return `${status}: ${title}`;
  }
  return `Request failed with status ${status}`;
}

/**
 * Perform an authenticated GET against `path` (e.g. `/v1/vehicles/vin/1FT...`). Resolves with the
 * status and parsed JSON body for any HTTP response; throws only for transport/timeout failures, so
 * callers can branch on `status` (a 401 means a bad key, not a thrown error).
 */
export async function apiGet(options: ApiClientOptions, path: string): Promise<ApiResponse> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await doFetch(`${options.baseUrl}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.apiKey}`,
        "user-agent": "vehicles-cli"
      },
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request to ${options.baseUrl}${path} timed out`);
    }
    throw new Error(`Could not reach ${options.baseUrl}: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

/** Like {@link apiGet} but throws {@link ApiError} on any non-2xx status. */
export async function apiGetOk(options: ApiClientOptions, path: string): Promise<unknown> {
  const { status, body } = await apiGet(options, path);
  if (status < 200 || status >= 300) throw new ApiError(status, body);
  return body;
}

/**
 * Cheaply check whether a key authenticates, without spending a metered call. A deliberately invalid
 * VIN authenticates first (401 for a bad key) and then fails request validation (400) before any
 * billable work, so a valid key returns a non-401 status and a bad key returns 401.
 */
export async function verifyApiKey(options: ApiClientOptions): Promise<boolean> {
  const { status } = await apiGet(options, "/v1/vehicles/vin/0");
  return status !== 401;
}
