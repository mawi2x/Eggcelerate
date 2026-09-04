import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Typography } from "../app/components/ui/typography";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("Typography", () => {
  it("maps semantic variants to the shared type tokens", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <>
          <Typography as="h1" variant="pageTitle">
            Incubators
          </Typography>
          <Typography variant="body">Manage each chamber.</Typography>
        </>,
      ),
    );

    const heading = container.querySelector("h1");
    const body = container.querySelector("p");
    expect(heading?.style.fontFamily).toBe("var(--font-display)");
    expect(heading?.style.fontSize).toBe("var(--type-page-title)");
    expect(heading?.style.lineHeight).toBe("var(--leading-snug)");
    expect(body?.style.fontFamily).toBe("var(--font-body)");
    expect(body?.style.fontSize).toBe("var(--type-body)");

    await act(async () => root.unmount());
  });

  it("allows a shared component to override a role default", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <Typography variant="caption" style={{ fontWeight: 600 }}>
          Supporting status
        </Typography>,
      ),
    );

    expect(container.querySelector("p")?.style.fontWeight).toBe("600");

    await act(async () => root.unmount());
  });
});
