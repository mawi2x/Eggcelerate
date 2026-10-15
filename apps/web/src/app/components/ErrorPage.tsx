import { House, RotateCcw } from "lucide-react";
import logoApp from "../../imports/logo-app.webp";
import { Button } from "./ui/button";

interface Props {
  kind?: "not-found" | "load-error";
  needsReload?: boolean;
  onRetry?: () => void;
  onHome?: () => void;
}

export function ErrorPage({
  kind = "not-found",
  needsReload = false,
  onRetry,
  onHome,
}: Props) {
  const missing = kind === "not-found";
  return (
    <section
      role={missing ? "status" : "alert"}
      aria-labelledby="error-page-title"
      className="flex min-h-[calc(100dvh-4rem)] w-full flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-5 py-12 text-center text-[var(--text-primary)] md:min-h-[calc(100dvh-3rem)]"
    >
      <div
        aria-hidden="true"
        className="mb-8 flex items-center justify-center gap-3 sm:gap-5"
      >
        {missing && (
          <span className="font-display text-7xl font-bold text-[var(--brand-primary)] sm:text-8xl">
            4
          </span>
        )}
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-[var(--border-default)] bg-[var(--surface-app)] sm:h-36 sm:w-36">
          <img
            src={logoApp}
            alt=""
            width={88}
            height={88}
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
          />
        </div>
        {missing && (
          <span className="font-display text-7xl font-bold text-[var(--brand-primary)] sm:text-8xl">
            4
          </span>
        )}
      </div>
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
        {missing ? "404 · A little off the nest" : "A little hatch hiccup"}
      </p>
      <h1
        id="error-page-title"
        className="font-display text-2xl font-bold sm:text-3xl"
      >
        {missing ? "Eggs not found" : "This egg didn’t hatch"}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
        {missing
          ? "We couldn’t find this page. Let’s get you back to your flock."
          : needsReload
            ? "This page may have been updated. Reload to open the latest version."
            : "Something interrupted this screen. Try again or head back to your dashboard."}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {!missing && onRetry && (
          <Button className="rounded-xl" onClick={onRetry}>
            <RotateCcw size={17} aria-hidden="true" />
            {needsReload ? "Reload page" : "Try again"}
          </Button>
        )}
        <Button
          asChild
          variant={missing ? "default" : "outline"}
          className="rounded-xl"
        >
          <a
            href="/"
            onClick={
              onHome
                ? (event) => {
                    event.preventDefault();
                    onHome();
                  }
                : undefined
            }
          >
            <House size={17} aria-hidden="true" />
            Back to dashboard
          </a>
        </Button>
        {!missing && !needsReload && (
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        )}
      </div>
    </section>
  );
}
