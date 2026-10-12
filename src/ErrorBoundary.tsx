import React from "react";

type State = { failed: boolean };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Local browser diagnostics only. Never send game state or credentials to telemetry.
    console.error("Chess Arena interface failed:", error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main role="alert" aria-live="assertive" style={{
        display: "grid", placeItems: "center", minHeight: "100vh",
        padding: 24, background: "#07130d", color: "#f1fff6", fontFamily: "system-ui"
      }}>
        <section style={{ maxWidth: 540, textAlign: "center" }}>
          <h1>Chess Arena needs a restart</h1>
          <p>The interface hit an unexpected error. Your connected account and saved games are not intentionally changed by this recovery screen.</p>
          <button type="button" onClick={() => window.location.reload()} style={{
            padding: "12px 20px", borderRadius: 10, border: "2px solid #62d27f",
            background: "#183b25", color: "#fff", cursor: "pointer"
          }}>Reload Chess Arena</button>
        </section>
      </main>
    );
  }
}
