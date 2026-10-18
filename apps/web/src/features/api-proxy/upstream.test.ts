import { describe, expect, it } from "vitest";
import { apiOrigin, requestHeadersFor, responseHeadersFor, upstreamUrl } from "./upstream";

describe("api proxy", () => {
  it("reads the API origin with or without a scheme, defaulting to the local API", () => {
    expect(apiOrigin(undefined)).toBe("http://localhost:4100");
    expect(apiOrigin("cutroom-api:10000")).toBe("http://cutroom-api:10000");
    expect(apiOrigin("https://api.cutroom.tech/")).toBe("https://api.cutroom.tech");
  });

  it("builds the upstream URL and refuses to step outside the API", () => {
    const origin = "http://api:4100";
    expect(upstreamUrl({ origin, segments: ["runs", "01ABC", "events"], search: "?x=1" })).toBe(
      "http://api:4100/runs/01ABC/events?x=1",
    );
    expect(upstreamUrl({ origin, segments: ["runs", "..", "admin"], search: "" })).toBeUndefined();
    expect(upstreamUrl({ origin, segments: ["a%2F..%2Fb"], search: "" })).toBe(
      "http://api:4100/a%252F..%252Fb",
    );
  });

  it("forwards only the headers the API needs, and keeps event streams unbuffered", () => {
    const sent = requestHeadersFor(
      new Headers({ range: "bytes=0-99", cookie: "cutroom_session=1", host: "cutroom.tech", referer: "x" }),
      new URL("http://0.0.0.0:3000/cutroom-api/runs"),
    );
    expect(sent.get("range")).toBe("bytes=0-99");
    expect(sent.get("cookie")).toBe("cutroom_session=1");
    expect(sent.get("x-forwarded-host")).toBe("cutroom.tech");
    expect(sent.get("x-forwarded-proto")).toBe("http");
    expect(sent.has("referer")).toBe(false);
    expect(sent.has("host")).toBe(false);
    const returned = responseHeadersFor(
      new Headers({ "content-type": "text/event-stream", "content-encoding": "gzip", "content-range": "x" }),
    );
    expect(returned.get("x-accel-buffering")).toBe("no");
    expect(returned.has("content-encoding")).toBe(false);
    expect(returned.get("content-range")).toBe("x");
    const cookies = new Headers();
    cookies.append("set-cookie", "a=1; Path=/");
    cookies.append("set-cookie", "b=2; Path=/");
    expect(responseHeadersFor(cookies).getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });
});
