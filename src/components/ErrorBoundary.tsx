import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ForgeTraceIQ ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-[hsl(220,14%,8%)] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-rose-500/20 bg-[hsl(220,14%,12%)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white/80">Something went wrong</h2>
                <p className="text-xs text-white/40">The app crashed unexpectedly</p>
              </div>
            </div>

            <div className="rounded-lg bg-black/40 p-3 mb-4 overflow-auto max-h-40">
              <p className="text-xs font-mono text-rose-400 break-all">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 h-10 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="h-4 w-4" /> Reload App
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                className="flex-1 h-10 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
