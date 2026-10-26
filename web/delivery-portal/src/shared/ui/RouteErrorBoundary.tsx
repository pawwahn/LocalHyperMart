import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; label?: string };

type State = { error: Error | null };

/** Catches render errors so agent pages show a message instead of a blank screen. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', this.props.label ?? 'page', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            margin: '1rem auto',
            maxWidth: '26rem',
            padding: '1rem',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <strong style={{ fontSize: '1rem' }}>This screen could not load</strong>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {this.state.error.message || 'Something went wrong rendering the page.'}
          </p>
          <button
            type="button"
            style={{
              justifySelf: 'start',
              border: 'none',
              borderRadius: 10,
              padding: '0.5rem 0.75rem',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
