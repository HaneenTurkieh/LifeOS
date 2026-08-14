import React from 'react';

// There was no ErrorBoundary anywhere in the app before this — any
// uncaught render error, on ANY page, unmounted the entire React tree
// and left the user staring at a blank white screen with no way back
// except manually reloading (and no idea that was even the fix). This
// wraps <App/> in main.jsx so a crash in one page's render — e.g. the
// unvalidated `mode` bug in FocusContext.jsx that made "flow is
// crashing" also look like "the whole app is broken" — gets contained
// to a friendly recovery screen instead of taking everything down.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Best-effort console trace for local debugging — deliberately not
    // wired to the server-side error_logs table (that's for AI-call
    // failures Lumi's routes already catch server-side); a render crash
    // can happen before auth is even ready, so there's no reliable
    // authenticated place to send it from here yet.
    console.error('Uncaught render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: 24, textAlign: 'center', background: '#0c0a1a', color: '#fff',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 40 }}>✦</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 360, margin: 0 }}>
          This page hit an unexpected error. Reloading usually fixes it — your data is safe either way.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '10px 20px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #8B6CF6 0%, #4C3A9E 100%)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Reload Nuvora
        </button>
      </div>
    );
  }
}
