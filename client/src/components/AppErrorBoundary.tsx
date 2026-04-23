import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
  errorInfo?: { componentStack: string };
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
  state: State = { error: undefined, errorInfo: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ error, errorInfo });

    const context = collectSessionContext();

    // Log to server — /api/errors/log is the correct endpoint
    fetch(getApiUrl("/api/errors/log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "AppErrorBoundary",
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    }).catch(() => {
      // Silent fail - don't throw in error boundary
      console.error("[AppErrorBoundary] crash:", error.message, error.stack);
    });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full" role="alert">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              We've encountered an unexpected error. Our team has been notified and is working on fixing it.
            </p>
            
            {import.meta.env.DEV && (
              <details className="bg-red-50 p-4 rounded-lg border border-red-200">
                <summary className="cursor-pointer font-semibold text-red-900 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-800 overflow-auto max-h-64">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Reload Page
              </Button>
              <Button
                onClick={() => window.location.href = "/"}
                variant="outline"
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
