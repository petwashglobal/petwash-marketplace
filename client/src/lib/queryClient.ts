import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAppCheckToken } from "./firebase";
import { getApiUrl } from "./apiConfig";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle PASSKEY_REQUIRED enforcement
    if (res.status === 403 && text.includes('PASSKEY_REQUIRED')) {
      // Show toast notification
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('passkey-required', {
          detail: { message: 'Passkey authentication is required for your role' }
        });
        window.dispatchEvent(event);
        
        // Redirect to security settings after a short delay
        setTimeout(() => {
          window.location.href = '/settings/security';
        }, 1500);
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

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

  const res = await fetch(getApiUrl(url), {
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
    // CRITICAL FIX: Ensure getAppCheckToken failure doesn't break API calls
    // If App Check is disabled or fails, we continue without the token (fail-open)
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

    const res = await fetch(getApiUrl(queryKey[0] as string), {
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
      staleTime: 5 * 60 * 1000, // 5 minutes (was Infinity - prevents unbounded memory growth)
      cacheTime: 10 * 60 * 1000, // 10 minutes garbage collection (cache pruning) - TanStack Query v5 compatible
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
