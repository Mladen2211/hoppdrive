'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="py-16 text-center text-neutral-500">
          <p className="text-sm">Dieser Bereich konnte nicht geladen werden.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
