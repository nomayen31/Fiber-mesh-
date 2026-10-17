/**
 * API client for the existing Next.js backend.
 *
 * Authentication is the **same signed admin JWT** the website uses, obtained
 * from `POST /api/admin/mobile/login` and presented as
 * `Authorization: Bearer <token>`. No admin credentials are stored in the app,
 * and nothing is sent with cookies (a native client has no ambient cookie jar to
 * protect, so bearer-only avoids CSRF concerns entirely).
 */

/** Shape of every error the backend returns: `{ error: string, fields?: {...} }`. */
type ErrorBody = { error?: string; fields?: Record<string, string> };

export class ApiError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  /** The session is gone or was never valid — the app must return to login. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** The phone could not reach the server at all. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  /** Read fresh on every request, so a re-login takes effect immediately. */
  getToken: () => string | null;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getToken = options.getToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get url(): string {
    return this.baseUrl;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new ApiError(
        aborted
          ? "সার্ভার সময়মতো উত্তর দেয়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।"
          : "সার্ভারে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।",
        0,
      );
    } finally {
      clearTimeout(timer);
    }

    // 204 and other bodyless responses.
    const text = await response.text().catch(() => "");
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const errorBody = (parsed ?? {}) as ErrorBody;
      throw new ApiError(
        errorBody.error ??
          `অনুরোধ ব্যর্থ হয়েছে (HTTP ${response.status})।`,
        response.status,
        errorBody.fields,
      );
    }

    return (parsed ?? {}) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body ?? {});
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }
}
