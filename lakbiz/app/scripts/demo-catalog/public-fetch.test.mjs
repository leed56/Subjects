import { describe, expect, it, vi } from "vitest";
import { fetchPublicText } from "./public-fetch.mjs";
import { parseSparProductTitle } from "./spar-detail.mjs";
const url = "https://spar2u.lk/products/example";
const fullTitle = "Example shampoo 250ml";
const success = () => new Response(`<h1>${fullTitle}</h1>`);
function fixture() {
  return { fetchImpl: vi.fn(), beforeAttempt: vi.fn(async () => {}), wait: vi.fn(async () => {}), onRetry: vi.fn() };
}
describe("bounded public catalog recovery", () => {
  it("recovers a 503 product page and hydrates the full title", async () => {
    const options = fixture();
    options.fetchImpl.mockResolvedValueOnce(new Response("Unavailable", { status: 503 })).mockResolvedValueOnce(success());
    const html = await fetchPublicText(url, options);
    expect(parseSparProductTitle(html)).toBe(fullTitle);
    expect(options.fetchImpl).toHaveBeenCalledTimes(2);
    expect(options.beforeAttempt).toHaveBeenCalledTimes(2);
    expect(options.wait).toHaveBeenCalledWith(1000);
    expect(options.onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, maxAttempts: 3 }));
  });
  it("stops after three failed attempts; never fabricates a title", async () => {
    const options = fixture();
    options.fetchImpl.mockImplementation(async () => new Response("Unavailable", { status: 503 }));
    await expect(fetchPublicText(url, options)).rejects.toThrow("503");
    expect(options.fetchImpl).toHaveBeenCalledTimes(3);
    expect(options.wait.mock.calls).toEqual([[1000], [2000]]);
  });
  it.each([401, 403, 404])("does not retry HTTP %i", async status => {
    const options = fixture();
    options.fetchImpl.mockResolvedValue(new Response("Denied", { status }));
    await expect(fetchPublicText(url, options)).rejects.toThrow(String(status));
    expect(options.fetchImpl).toHaveBeenCalledTimes(1);
    expect(options.wait).not.toHaveBeenCalled();
  });
  it.each([500, 502, 504])("recovers transient HTTP %i", async status => {
    const options = fixture();
    options.fetchImpl.mockResolvedValueOnce(new Response("Unavailable", { status })).mockResolvedValueOnce(success());
    await expect(fetchPublicText(url, options)).resolves.toContain(fullTitle);
  });
  it("honors bounded Retry-After and stops persistent rate limiting", async () => {
    const options = fixture();
    options.fetchImpl.mockImplementation(async () => new Response("Limited", { status: 429, headers: { "retry-after": "999" } }));
    await expect(fetchPublicText(url, options)).rejects.toThrow("429");
    expect(options.fetchImpl).toHaveBeenCalledTimes(3);
    expect(options.wait.mock.calls).toEqual([[30000], [30000]]);
  });
  it("supports HTTP-date Retry-After without unbounded waits", async () => {
    const options = fixture();
    options.fetchImpl.mockResolvedValueOnce(new Response("Limited", { status: 429, headers: { "retry-after": "Sun, 11 Oct 2026 12:00:10 GMT" } })).mockResolvedValueOnce(success());
    await fetchPublicText(url, { ...options, now: () => Date.parse("2026-10-11T12:00:00Z") });
    expect(options.wait).toHaveBeenCalledWith(10000);
  });
  it("recovers a network failure and passes a timeout signal", async () => {
    const options = fixture();
    options.fetchImpl.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(success());
    await fetchPublicText(url, options);
    expect(options.fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("times out hung requests and bounds their retries", async () => {
    const options = fixture();
    options.fetchImpl.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    await expect(fetchPublicText(url, { ...options, timeoutMs: 10 })).rejects.toThrow("Aborted");
    expect(options.fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("does not hide malformed HTML behind a network success", async () => {
    const options = fixture();
    options.fetchImpl.mockResolvedValue(new Response("<h1>Still truncated...</h1>"));
    expect(parseSparProductTitle(await fetchPublicText(url, options))).toBeNull();
    expect(options.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("propagates non-network programming errors without retry", async () => {
    const options = fixture();
    options.fetchImpl.mockRejectedValue(new Error("Invalid fixture"));
    await expect(fetchPublicText(url, options)).rejects.toThrow("Invalid fixture");
    expect(options.wait).not.toHaveBeenCalled();
  });
});
