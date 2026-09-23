import type { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "../app/App";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

function createRepositoryThatFailsReadingsOnce() {
  const repository = new InMemoryEggcelerateRepository();
  const listReadings = repository.listReadings.bind(repository);
  let shouldFail = true;
  const calls = { count: 0 };
  repository.listReadings = async (query) => {
    calls.count += 1;
    if (shouldFail) {
      shouldFail = false;
      return {
        ok: false,
        error: { code: "offline", message: "Readings service is offline." },
      };
    }
    return listReadings(query);
  };
  return { repository, calls };
}

async function mountRoute(
  route: string,
  repository: InMemoryEggcelerateRepository,
) {
  const location = memoryLocation({ path: route, record: true });
  const queryClient: QueryClient = createAppQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  });
  const mounted = await render(
    <Router hook={location.hook}>
      <AppProviders repository={repository} queryClient={queryClient}>
        <App />
      </AppProviders>
    </Router>,
  );
  return { ...mounted, location };
}

describe("historical reading states", () => {
  it("shows a retryable sensor-history error in chamber detail", async () => {
    const { repository, calls } = createRepositoryThatFailsReadingsOnce();
    const mounted = await mountRoute("/incubators/chamber-1", repository);
    try {
      await waitFor(
        () =>
          calls.count > 0 &&
          [...mounted.container.querySelectorAll('[role="alert"]')].some(
            (alert) =>
              alert.textContent?.includes("Sensor history could not be loaded"),
          ),
        "Detail did not show the failed readings state.",
      );
      const alert = [
        ...mounted.container.querySelectorAll<HTMLElement>('[role="alert"]'),
      ].find((item) =>
        item.textContent?.includes("Sensor history could not be loaded"),
      );
      const retry = alert?.querySelector<HTMLButtonElement>("button");
      expect(retry?.textContent).toContain("Retry");
      await act(async () => retry?.click());
      await waitFor(
        () =>
          ![...mounted.container.querySelectorAll('[role="alert"]')].some(
            (item) =>
              item.textContent?.includes("Sensor history could not be loaded"),
          ),
        "Detail did not recover after retrying readings.",
      );
      expect(calls.count).toBeGreaterThanOrEqual(2);
    } finally {
      await mounted.unmount();
    }
  });

  it("shows a retryable readings error in Trends and clears it after retry", async () => {
    const { repository, calls } = createRepositoryThatFailsReadingsOnce();
    const mounted = await mountRoute("/trends", repository);
    try {
      await waitFor(
        () =>
          calls.count > 0 &&
          [...mounted.container.querySelectorAll('[role="alert"]')].some(
            (alert) =>
              alert.textContent?.includes(
                "Environmental readings could not be loaded",
              ),
          ),
        "Trends did not show the failed readings state.",
      );
      const alert = [
        ...mounted.container.querySelectorAll<HTMLElement>('[role="alert"]'),
      ].find((item) =>
        item.textContent?.includes(
          "Environmental readings could not be loaded",
        ),
      );
      const retry = alert?.querySelector<HTMLButtonElement>("button");
      expect(retry?.textContent).toContain("Retry");
      await act(async () => retry?.click());
      await waitFor(
        () =>
          ![...mounted.container.querySelectorAll('[role="alert"]')].some(
            (item) =>
              item.textContent?.includes(
                "Environmental readings could not be loaded",
              ),
          ),
        "Trends did not recover after retrying readings.",
      );
      expect(calls.count).toBeGreaterThan(1);
    } finally {
      await mounted.unmount();
    }
  });
});
