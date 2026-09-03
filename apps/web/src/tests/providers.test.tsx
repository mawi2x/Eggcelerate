import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { EggcelerateRepository } from "../app/data/repositories/repository";
import { requireResultData, RepositoryQueryError } from "../app/features/farm/repository-query";
import { AppProviders, createAppQueryClient } from "../app/providers/AppProviders";
import { useRepository } from "../app/providers/repository-context";

describe("AppProviders", () => {
  it("injects the selected repository implementation", () => {
    const repository = new InMemoryEggcelerateRepository();
    let observed: EggcelerateRepository | null = null;

    function Probe() {
      observed = useRepository();
      return <span>ready</span>;
    }

    const html = renderToString(
      <AppProviders repository={repository} queryClient={createAppQueryClient()}>
        <Probe />
      </AppProviders>,
    );

    expect(html).toContain("ready");
    expect(observed).toBe(repository);
  });

  it("turns structured repository failures into query errors", () => {
    expect(() => requireResultData({
      ok: false,
      error: { code: "offline", message: "Repository unavailable." },
    })).toThrowError(RepositoryQueryError);
  });
});
