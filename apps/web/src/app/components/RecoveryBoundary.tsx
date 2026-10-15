import { Component, type ReactNode } from "react";
import { ErrorPage } from "./ErrorPage";

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
      <div
        className={
          isApp ? "min-h-dvh bg-[var(--surface-app)] p-4 md:p-6" : "w-full"
        }
      >
        <ErrorPage
          kind="load-error"
          needsReload={this.state.needsReload}
          onRetry={() => {
            if (this.state.needsReload) {
              window.location.reload();
              return;
            }
            this.props.onRetry?.();
            this.setState({ failed: false, needsReload: false });
          }}
        />
      </div>
    );
  }
}
