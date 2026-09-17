import { describe, expect, it } from "vitest";
import { resolveDataSource } from "../app/data/transport/env";

describe("data source resolution", () => {
  it("defaults to the mock repository", () => {
    expect(resolveDataSource({})).toEqual({ source: "mock", apiUrl: null });
  });

  it("rejects unknown sources", () => {
    expect(() => resolveDataSource({ VITE_DATA_SOURCE: "grpc" })).toThrow();
  });

  it("requires a URL in api mode and strips trailing slashes", () => {
    expect(() => resolveDataSource({ VITE_DATA_SOURCE: "api" })).toThrow();
    expect(
      resolveDataSource({
        VITE_DATA_SOURCE: "api",
        VITE_API_URL: "http://127.0.0.1:8000/api/v1///",
      }),
    ).toEqual({ source: "api", apiUrl: "http://127.0.0.1:8000/api/v1" });
  });

  it("accepts the same-origin API paths used by the production proxy", () => {
    expect(
      resolveDataSource({ VITE_DATA_SOURCE: "api", VITE_API_URL: "/api///" }),
    ).toEqual({ source: "api", apiUrl: "/api" });
    expect(
      resolveDataSource({
        VITE_DATA_SOURCE: "api",
        VITE_API_URL: "/api/v1///",
      }),
    ).toEqual({ source: "api", apiUrl: "/api/v1" });
  });

  it("rejects non-http API URLs", () => {
    expect(() =>
      resolveDataSource({ VITE_DATA_SOURCE: "api", VITE_API_URL: "mqtt://x" }),
    ).toThrow();
    expect(() =>
      resolveDataSource({
        VITE_DATA_SOURCE: "api",
        VITE_API_URL: "http://not a host",
      }),
    ).toThrow();
    expect(() =>
      resolveDataSource({ VITE_DATA_SOURCE: "api", VITE_API_URL: "not-a-url" }),
    ).toThrow();
    expect(() =>
      resolveDataSource({
        VITE_DATA_SOURCE: "api",
        VITE_API_URL: "/internal-api",
      }),
    ).toThrow();
  });
});
