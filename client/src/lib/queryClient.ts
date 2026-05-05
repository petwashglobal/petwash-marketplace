import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAppCheckToken } from "./firebase";
import { getApiUrl } from "./apiConfig";

async function getFirebaseBearerToken(): Promise<string | null> {
  try {
    const { auth } = await import("./firebase");
    const user = auth?.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    console.warn('[QueryClient] Failed to get Firebase ID token', error);
  }
  return null;
}

export class ApiError extends Error {
  status: number;
  traceId: string;
  userMessage: string;
  body: any;

  constructor(status: number, body: any, traceId: string) {
    const serverMsg = body?.message || body?.error || '';
    super(`${status}: ${serverMsg || 'Request failed'}`);
    this.status = status;
    this.traceId = traceId;
    this.body = body;
    this.userMessage = getUserMessage(status, serverMsg);
  }
}

function getUserMessage(status: number, serverMsg: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No internet connection. Please check your connection and try again.';
  }
  switch (status) {
    case 401:
      return 'Session expired. Please sign in again.';
    case 403:
      return 'Not authorized.';
    case 404:
      return 'Not found.';
    case 409:
      return serverMsg || 'This action conflicts with existing data.';
    case 429:
      return 'Too many attempts. Please wait and try again.';
    case 503:
      return 'Service temporarily unavailable. Please try again in a moment.';
    default:
      if (status >= 500) return 'Something went wrong on our end. Please try again.';
      return serverMsg || 'Something went wrong. Please try again.';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const traceId = res.headers.get('x-trace-id') || '';
    let body: any = null;
    const text = await res.text().catch(() => '');

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text || res.statusText };
    }

    if (res.status === 403 && text.includes('PASSKEY_REQUIRED')) {
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('passkey-required', {
          detail: { message: 'Passkey authentication is required for your role' }
        });
        window.dispatchEvent(event);
        setTimeout(() => {
          window.location.href = '/settings/security';
        }, 1500);
      }
    }

    if (typeof window !== 'undefined') {
      console.error('[API Error]', {
        url: res.url,
        status: res.status,
        traceId,
        body,
      });
    }

    throw new ApiError(res.status, body, traceId);
  }
}

// Re-export the cold-start 503 retry helper from the standalone module so
// queryClient consumers keep their existing import surface unchanged.
export { fetchWithRetry, FETCH_RETRY_503_DELAYS_MS } from './fetchWithRetry';
import { fetchWithRetry } from './fetchWithRetry';

export async function apiRequest(
  methodOrUrl: string,
  urlOrOptions?: string | Record<string, any>,
  data?: unknown | undefined,
): Promise<Response> {
  let method: string;
  let url: string;
  let body: any;
  let extraHeaders: Record<string, string> = {};

  if (methodOrUrl.startsWith('/') || methodOrUrl.startsWith('http')) {
    url = methodOrUrl;
    if (typeof urlOrOptions === 'string') {
      method = urlOrOptions;
      body = data ? JSON.stringify(data) : undefined;
      if (data) extraHeaders["Content-Type"] = "application/json";
    } else if (urlOrOptions && typeof urlOrOptions === 'object') {
      method = urlOrOptions.method || 'GET';
      body = urlOrOptions.body;
      if (urlOrOptions.headers) {
        Object.assign(extraHeaders, urlOrOptions.headers);
      }
      if (body && typeof body === 'string' && !extraHeaders["Content-Type"]) {
        extraHeaders["Content-Type"] = "application/json";
      } else if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !extraHeaders["Content-Type"]) {
        body = JSON.stringify(body);
        extraHeaders["Content-Type"] = "application/json";
      }
    } else {
      method = 'GET';
      body = undefined;
    }
  } else {
    method = methodOrUrl;
    url = urlOrOptions as string;
    body = data ? JSON.stringify(data) : undefined;
    if (data) extraHeaders["Content-Type"] = "application/json";
  }

  let appCheckToken: string | null = null;
  try {
    appCheckToken = await getAppCheckToken();
  } catch (error) {
    console.warn('[QueryClient] Failed to get App Check token, continuing without it', error);
  }

  const headers: Record<string, string> = { ...extraHeaders };
  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  if (!headers["Authorization"]) {
    const bearerToken = await getFirebaseBearerToken();
    if (bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }
  }

  const res = await fetchWithRetry(getApiUrl(url), {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let appCheckToken: string | null = null;
    try {
      appCheckToken = await getAppCheckToken();
    } catch (error) {
      console.warn('[QueryClient] Failed to get App Check token, continuing without it', error);
    }
    
    const headers: Record<string, string> = {};
    if (appCheckToken) {
      headers["X-Firebase-AppCheck"] = appCheckToken;
    }

    const bearerToken = await getFirebaseBearerToken();
    if (bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    const res = await fetchWithRetry(getApiUrl(queryKey[0] as string), {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 503 && failureCount < 1) return true;
        return false;
      },
      retryDelay: 800,
    },
    mutations: {
      retry: false,
    },
  },
});
