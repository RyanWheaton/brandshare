import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });

  // Don't throw if the request was aborted
  if (signal?.aborted) {
    console.log("Request aborted, skipping error handling.");
    return res;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      // Don't throw if the request was aborted
      if (signal?.aborted) {
        console.log("Query request aborted, skipping error handling.");
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Query aborted, skipping error handling.");
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry aborted requests
        if (error instanceof DOMException && error.name === "AbortError") {
          return false;
        }
        return failureCount < 1;
      },
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});