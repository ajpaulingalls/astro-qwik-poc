import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { graphqlFetch } from "./graphql";

interface CapturedFetchCall {
  url: string;
  init: RequestInit;
}

function mockFetch(payload: unknown): {
  fetch: ReturnType<typeof vi.fn>;
  calls: CapturedFetchCall[];
} {
  const calls: CapturedFetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch: fetchMock, calls };
}

const ORIGINAL_FETCH = globalThis.fetch;

describe("graphqlFetch", () => {
  let calls: CapturedFetchCall[];

  beforeEach(() => {
    const m = mockFetch({ data: { homepage: { layout: "three-column" } } });
    calls = m.calls;
    globalThis.fetch = m.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it("builds a GET URL with operationName, URL-encoded variables, and extensions={}", async () => {
    await graphqlFetch({
      operationName: "HomePageQuery",
      variables: { isAtf: true, atfLength: 2, slug: "", preview: "" },
    });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/graphql");
    expect(url.searchParams.get("operationName")).toBe("HomePageQuery");
    expect(url.searchParams.get("wp-site")).toBe("aje");
    expect(JSON.parse(url.searchParams.get("variables") ?? "{}")).toEqual({
      isAtf: true,
      atfLength: 2,
      slug: "",
      preview: "",
    });
    expect(url.searchParams.get("extensions")).toBe("{}");
    expect(calls[0].init.method ?? "GET").toBe("GET");
  });

  it("injects the wp-site header (default aje)", async () => {
    await graphqlFetch({ operationName: "HomePageQuery" });
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("wp-site")).toBe("aje");
  });

  it("honours an explicit wpSite override (aja)", async () => {
    await graphqlFetch({ operationName: "HomePageQuery", wpSite: "aja" });
    const url = new URL(calls[0].url);
    const headers = new Headers(calls[0].init.headers);
    expect(url.searchParams.get("wp-site")).toBe("aja");
    expect(headers.get("wp-site")).toBe("aja");
  });

  it("returns json.data typed as T", async () => {
    const result = await graphqlFetch<{ homepage: { layout: string } }>({
      operationName: "HomePageQuery",
    });
    expect(result.homepage.layout).toBe("three-column");
  });

  it("falls back to http://localhost:4455 when PUBLIC_API_BASE is unset", async () => {
    vi.stubEnv("PUBLIC_API_BASE", "");
    await graphqlFetch({ operationName: "HomePageQuery" });
    expect(calls[0].url.startsWith("http://localhost:4455/graphql?")).toBe(true);
  });

  it("uses PUBLIC_API_BASE from import.meta.env when set", async () => {
    vi.stubEnv("PUBLIC_API_BASE", "https://api.example.test");
    await graphqlFetch({ operationName: "HomePageQuery" });
    expect(calls[0].url.startsWith("https://api.example.test/graphql?")).toBe(true);
  });
});
