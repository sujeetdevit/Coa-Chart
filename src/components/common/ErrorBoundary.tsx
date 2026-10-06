import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** What failed, for the message: "The chart could not be drawn." */
  what: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | undefined;
}

/**
 * Catches an error thrown while drawing its children and offers to try again, so one bad
 * record or a bug in one panel does not leave a blank page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app-message error" role="alert">
        <p>
          <strong>{this.props.what}</strong> {error.message}
        </p>
        <button
          type="button"
          onClick={() => {
            this.setState({ error: undefined });
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
