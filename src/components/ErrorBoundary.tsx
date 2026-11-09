import React from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    console.error('[Application ErrorBoundary Caught Error]:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearStorageAndReload = (): void => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleCopyError = (): void => {
    const errorDetails = `Error: ${this.state.error?.message || 'Unknown'}\nStack: ${this.state.error?.stack || ''}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#1C1D1A] text-[#282925] dark:text-[#E8E6DF] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#252622] rounded-3xl p-6 sm:p-8 border border-[#B7B7A4]/30 shadow-xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold font-serif">Something paused your study flow</h2>
              <p className="text-xs text-muted-foreground text-[#6B705C] dark:text-[#A5A58D] mt-1.5">
                The application encountered an unexpected glitch. Your study data is safely preserved in local storage.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-stone-100 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 text-[11px] font-mono text-stone-700 dark:text-stone-300 max-h-28 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-[#6B705C] hover:bg-[#585C4B] text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload & Continue Studying</span>
              </button>

              <button
                onClick={this.handleClearStorageAndReload}
                className="w-full py-2 px-4 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reset View State & Reload</span>
              </button>

              <button
                onClick={this.handleCopyError}
                className="w-full py-1.5 px-3 text-[11px] text-[#6B705C] dark:text-[#A5A58D] hover:underline flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">Error Log Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Diagnostic Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
