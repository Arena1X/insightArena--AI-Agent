import * as http from "node:http";
import * as https from "node:https";

const EXTERNAL_NETWORK_ERROR = "External network access is disabled in tests";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHostname(host: string): string {
  if (host.startsWith("[")) {
    return host.slice(1, host.indexOf("]"));
  }

  return host.split(":")[0].toLowerCase();
}

function hostnameFrom(target: unknown): string | undefined {
  if (target instanceof URL) {
    return target.hostname;
  }

  if (typeof Request !== "undefined" && target instanceof Request) {
    return new URL(target.url).hostname;
  }

  if (typeof target === "string") {
    try {
      return new URL(target, "http://localhost").hostname;
    } catch {
      return undefined;
    }
  }

  if (target && typeof target === "object") {
    const options = target as http.RequestOptions;
    const host = options.hostname ?? options.host;
    return host ? normalizeHostname(host) : undefined;
  }

  return undefined;
}

function assertLoopback(target: unknown): void {
  const hostname = hostnameFrom(target);

  if (hostname && !LOOPBACK_HOSTS.has(normalizeHostname(hostname))) {
    throw new Error(`${EXTERNAL_NETWORK_ERROR}: ${hostname}`);
  }
}

function guardNodeRequest(
  owner: typeof http | typeof https,
  method: "request" | "get"
): void {
  const original = owner[method];

  jest
    .spyOn(
      owner as unknown as Record<string, (...args: unknown[]) => unknown>,
      method
    )
    .mockImplementation((...args: unknown[]) => {
      assertLoopback(args[0]);
      return Reflect.apply(original, owner, args);
    });
}

beforeAll(() => {
  guardNodeRequest(http, "request");
  guardNodeRequest(http, "get");
  guardNodeRequest(https, "request");
  guardNodeRequest(https, "get");

  if (typeof globalThis.fetch === "function") {
    const originalFetch = globalThis.fetch.bind(globalThis);
    jest.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      assertLoopback(input);
      return originalFetch(input, init);
    });
  }
});

afterAll(() => {
  jest.restoreAllMocks();
});
