import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-100">Logic Bridge Collapsed</h2>
          <p className="mb-6 max-w-md text-sm text-slate-400">
            We encountered a technical error while rendering this visualization. This often happens with experimental logic maps.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={this.handleRetry}
              className="gap-2 border-slate-700 hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry Render
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/dashboard")}
              className="text-slate-500 hover:text-slate-300"
            >
              Return to Dashboard
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-8 max-w-full overflow-auto rounded bg-slate-950 p-4 text-left text-[10px] text-red-400">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
