import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
  errorInfo?: { componentStack: string };
  referenceId?: string;
  isChunkError?: boolean;
  repeatedChunkFailure?: boolean;
}

/**
 * Generate a short reference ID (8 chars) users can quote to support.
 * Falls back to a Math.random-based ID when crypto.randomUUID is unavailable.
 */
function generateReferenceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Detect whether an error originated from a failed dynamic chunk load
 * (typical Vite/Webpack code-split failure after a deploy).
 */
function isChunkLoadError(error: Error): boolean {
  if (!error) return false;
  const name = error.name || "";
  const msg = error.message || "";
  if (name === "ChunkLoadError") return true;
  if (/Loading chunk [\d]+ failed/i.test(msg)) return true;
  if (/Failed to fetch dynamically imported module/i.test(msg)) return true;
  if (/Importing a module script failed/i.test(msg)) return true;
  if (/error loading dynamically imported module/i.test(msg)) return true;
  return false;
}

/**
 * Lightweight in-memory retry queue: track recent chunk-load failures
 * so we can show a stronger hint when the same issue keeps recurring.
 * Window: 60s, threshold: 2 prior failures (so the 3rd showing escalates).
 */
const CHUNK_RETRY_WINDOW_MS = 60_000;
const CHUNK_RETRY_THRESHOLD = 2;
const chunkErrorTimestamps: number[] = [];

function recordChunkFailure(): boolean {
  const now = Date.now();
  // Drop expired entries
  while (chunkErrorTimestamps.length && now - chunkErrorTimestamps[0] > CHUNK_RETRY_WINDOW_MS) {
    chunkErrorTimestamps.shift();
  }
  chunkErrorTimestamps.push(now);
  return chunkErrorTimestamps.length > CHUNK_RETRY_THRESHOLD;
}

/** Collect lightweight session context without blocking the error boundary. */
function collectSessionContext() {
  try {
    const nav = navigator as any;
    return {
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      // Network information (supported in Chrome/Edge; undefined elsewhere)
      connectionType: nav?.connection?.effectiveType ?? nav?.connection?.type ?? undefined,
      // Firebase UID from local storage / session storage (best-effort, no blocking)
      userId: (() => {
        try {
          // Firebase stores user data under keys like `firebase:authUser:*`
          const key = Object.keys(localStorage).find(k => k.startsWith("firebase:authUser:"));
          if (!key) return undefined;
          const parsed = JSON.parse(localStorage.getItem(key) || "{}");
          return parsed?.uid ?? undefined;
        } catch {
          return undefined;
        }
      })(),
      // User role from PetWash localStorage (if stored)
      userRole: localStorage.getItem("pw_role") ?? undefined,
      // Language preference
      language: localStorage.getItem("pw_lang") ?? undefined,
    };
  } catch {
    return {};
  }
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: undefined,
    errorInfo: undefined,
    referenceId: undefined,
    isChunkError: undefined,
    repeatedChunkFailure: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    const isChunk = isChunkLoadError(error);
    return {
      error,
      referenceId: generateReferenceId(),
      isChunkError: isChunk,
      repeatedChunkFailure: isChunk ? recordChunkFailure() : false,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ errorInfo });

    const context = collectSessionContext();
    const referenceId = this.state.referenceId ?? generateReferenceId();
    const isChunk = this.state.isChunkError ?? isChunkLoadError(error);
    const errorKind = isChunk ? "chunk-load" : "render";

    // Log to server — /api/errors/log is the correct endpoint
    fetch(getApiUrl("/api/errors/log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "AppErrorBoundary",
        referenceId,
        errorKind,
        repeatedChunkFailure: this.state.repeatedChunkFailure ?? false,
        message: error.message,
        errorName: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    }).catch(() => {
      // Silent fail - don't throw in error boundary
      console.error(
        "[AppErrorBoundary] crash:",
        referenceId,
        error.message,
        error.stack,
      );
    });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const { error, referenceId, isChunkError, repeatedChunkFailure } = this.state;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full" role="alert">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <CardTitle className="text-2xl">
                {isChunkError ? "A new version is available" : "Something went wrong"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isChunkError ? (
              <p className="text-gray-600">
                Part of the app failed to load. This usually means a newer version
                was just deployed. Reload to get the latest version.
              </p>
            ) : (
              <p className="text-gray-600">
                We've encountered an unexpected error. Our team has been notified
                and is working on fixing it.
              </p>
            )}

            {referenceId && (
              <p
                className="text-xs text-gray-500 font-mono"
                data-testid="error-reference-id"
              >
                Reference: {referenceId}
              </p>
            )}

            {isChunkError && repeatedChunkFailure && (
              <div
                className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-3"
                role="status"
              >
                This keeps happening. Try a hard reload to clear the cache:
                <span className="font-mono ml-1">Ctrl+Shift+R</span>
                <span className="text-gray-500"> (Windows/Linux) </span>
                or
                <span className="font-mono ml-1">Cmd+Shift+R</span>
                <span className="text-gray-500"> (Mac)</span>.
              </div>
            )}

            {import.meta.env.DEV && (
              <details className="bg-red-50 p-4 rounded-lg border border-red-200">
                <summary className="cursor-pointer font-semibold text-red-900 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-800 overflow-auto max-h-64">
                  {error.message}
                  {"\n\n"}
                  {error.stack}
                </pre>
              </details>
            )}

            {isChunkError ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1"
                  data-testid="reload-latest"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload to get the latest version
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Reload Page
                </Button>
                <Button
                  onClick={() => (window.location.href = "/")}
                  variant="outline"
                  className="flex-1"
                >
                  Go Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}
