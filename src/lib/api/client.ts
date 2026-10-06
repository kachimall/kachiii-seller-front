import type { Envelope, FieldErrors, PageMeta, Paginated } from "@/types/api";

export const API_URL = (process.env.NEXT_PUBLIC_SELLER_API_URL ?? "http://localhost:8001/api/v1").replace(/\/$/, "");
/** The shop portal: the public catalogue (categories, brands) is only served there. */
export const SHOP_API_URL = (process.env.NEXT_PUBLIC_SHOP_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
export const SHOP_URL = (process.env.NEXT_PUBLIC_SHOP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** An error answer from the API, with its HTTP status and any field errors (422). */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: FieldErrors;

  constructor(status: number, message: string, errors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** 403 because the account must turn on two-factor authentication first. */
  get needsTwoFactorSetup(): boolean {
    return this.status === 403 && "two_factor" in this.errors;
  }

  firstError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

// The auth store registers these so the client never imports it (no cycle, no React).
interface AuthHooks {
  getToken: () => string | null;
  onUnauthorized: () => void;
  onTwoFactorRequired: () => void;
}

let hooks: AuthHooks = {
  getToken: () => null,
  onUnauthorized: () => {},
  onTwoFactorRequired: () => {},
};

export function registerAuthHooks(next: AuthHooks) {
  hooks = next;
}

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Skip the global 401/2FA handling, e.g. on the login form. */
  skipAuthHandling?: boolean;
  /** Use this token instead of the signed-in one. */
  token?: string;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", query, body, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = options.token ?? hooks.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  try {
    // No credentials: the API uses bearer tokens and its CORS does not allow cookies.
    return await fetch(`${API_URL}${path}${buildQuery(query)}`, { method, headers, body: payload, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Could not reach the KACHI API. Check that the backend is running.");
  }
}

async function parse<T>(response: Response, options: RequestOptions): Promise<Envelope<T, unknown>> {
  let json: Partial<Envelope<T, unknown>> & { errors?: FieldErrors } = {};
  try {
    json = await response.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page).
  }

  if (!response.ok || json.success === false) {
    const error = new ApiError(response.status, json.message || defaultMessage(response.status), json.errors ?? {});
    if (!options.skipAuthHandling) {
      if (error.status === 401) hooks.onUnauthorized();
      else if (error.needsTwoFactorSetup) hooks.onTwoFactorRequired();
    }
    throw error;
  }

  return json as Envelope<T, unknown>;
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has ended. Sign in again.";
    case 403:
      return "You do not have access to this.";
    case 404:
      return "Not found.";
    case 409:
      return "This changed in the meantime. Reload and try again.";
    case 429:
      return "Too many requests. Wait a moment and try again.";
    case 503:
      return "The service is busy. Try again in a moment.";
    default:
      return "Something went wrong.";
  }
}

/** Calls the API and returns the unwrapped `data`. */
export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await send(path, options);
  return (await parse<T>(response, options ?? {})).data;
}

/** Calls the API and returns `data` with its `meta`. */
export async function apiWithMeta<T, M>(path: string, options?: RequestOptions): Promise<{ data: T; meta: M }> {
  const response = await send(path, options);
  const envelope = await parse<T>(response, options ?? {});
  return { data: envelope.data, meta: envelope.meta as M };
}

/** A paginated list: ?page=&per_page=, with meta {current_page, per_page, has_more, total, last_page}. */
export async function apiList<T>(path: string, query?: Query): Promise<Paginated<T>> {
  return apiWithMeta<T[], PageMeta>(path, { query });
}

/** Downloads a private file with the bearer token, e.g. to show an image through an object URL. */
export async function fetchBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await send(path, { signal });
  if (!response.ok) {
    await parse(response, {});
  }
  return response.blob();
}

/** Downloads a file (private documents need the bearer token) and opens it in a new tab. */
export async function openFile(path: string): Promise<void> {
  // Open the tab first so popup blockers treat it as user-initiated.
  const tab = window.open("", "_blank");
  try {
    const response = await send(path);
    if (!response.ok) {
      await parse(response, {});
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** A readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.errors)[0]?.[0];
    return error.status === 422 && first ? first : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/** Reads the shop portal's public catalogue (no token: a Seller Centre token is refused there). */
export async function shopApi<T>(path: string, query?: Query): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SHOP_API_URL}${path}${buildQuery(query)}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(0, "Could not reach the KACHI API.");
  }
  return (await parse<T>(response, { skipAuthHandling: true })).data;
}
