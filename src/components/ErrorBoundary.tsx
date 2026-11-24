import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let display = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        display = `Database ${parsed.operationType || 'operation'} error${
          parsed.path ? ` (${parsed.path})` : ''
        }: ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, errorMessage: display };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F8F6] text-[#171614] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E2DDD4] rounded-xl p-7 space-y-4">
            <p className="text-xs font-semibold text-[#9E6B3B]">
              Vishwakarma Interior Services Centre
            </p>
            <h1 className="text-2xl font-semibold text-[#171614]">
              Something went wrong while loading this view
            </h1>
            <p className="text-sm text-[#5C574F] leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.href = '/';
                }}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
