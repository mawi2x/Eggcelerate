import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";

type Props = {
  children: ReactNode;
  scope: "app" | "screen";
  onRetry?: () => void;
};

export class RecoveryBoundary extends Component<
  Props,
  { failed: boolean; needsReload: boolean }
> {
  state = { failed: false, needsReload: false };
  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      needsReload:
        error instanceof Error &&
        /dynamically imported module|module script|loading chunk|chunkloaderror|preload css/i.test(
          `${error.name} ${error.message}`,
        ),
    };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const isApp = this.props.scope === "app";
    return (
      <section
        role="alert"
        className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 text-[var(--text-primary)]"
      >
        <h1 className="text-xl font-bold">
          {isApp ? "The dashboard couldn’t load" : "This screen couldn’t load"}
        </h1>
        <p>
          {this.state.needsReload
            ? "This screen’s files could not be downloaded. Try again will reload the page."
            : isApp
              ? "Try again to reopen the dashboard."
              : "Your other screens are still available. Try again or return to the dashboard."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              if (this.state.needsReload) {
                window.location.reload();
                return;
              }
              this.props.onRetry?.();
              this.setState({ failed: false, needsReload: false });
            }}
          >
            Try again
          </Button>
          {!this.state.needsReload && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          )}
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg px-3 underline focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Back to dashboard
          </a>
        </div>
      </section>
    );
  }
}
