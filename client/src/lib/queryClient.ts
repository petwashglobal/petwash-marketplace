import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAppCheckToken } from "./firebase";

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
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const appCheckToken = await getAppCheckToken();
  
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
    const appCheckToken = await getAppCheckToken();
    
    const headers: Record<string, string> = {};
    if (appCheckToken) {
      headers["X-Firebase-AppCheck"] = appCheckToken;
    }

    const res = await fetch(queryKey[0] as string, {
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
