import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { DEFAULT_AUTHENTICATED_PATH, sanitizeNextPath } from "@/lib/auth/redirect";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/session";

/**
 * The design's threat matrix, row by row. Every row here MUST hold before the
 * gate is trusted with a real household's data.
 */

const ORIGIN = "https://tm.example";

function request(path: string, cookie?: string): NextRequest {
  const req = new NextRequest(new URL(path, ORIGIN));
  if (cookie !== undefined) {
    req.cookies.set(SESSION_COOKIE, cookie);
  }
  return req;
}

function locationOf(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location as string, ORIGIN);
}

function isRedirect(response: Response): boolean {
  return response.status === 307 || response.status === 308;
}

async function validCookie(): Promise<string> {
  return signSession(Math.floor(Date.now() / 1000));
}

async function expiredCookie(): Promise<string> {
  return signSession(Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SECONDS - 10);
}

async function tamperedCookie(): Promise<string> {
  const [payload, signature] = (await validCookie()).split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.exp += 60 * 60 * 24 * 365;
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}

describe("threat matrix: rejected sessions never reach a route", () => {
  it.each([
    ["absent", undefined],
    ["malformed", "not-a-cookie"],
    ["unsigned", "eyJ2IjoxLCJpYXQiOjAsImV4cCI6OTk5OTk5OTk5OX0"],
    ["empty", ""],
  ])("%s cookie redirects to /login carrying the requested path", async (_l, cookie) => {
    const response = await proxy(request("/movimientos", cookie));

    expect(isRedirect(response)).toBe(true);
    const location = locationOf(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/movimientos");
  });

  it("expired cookie is deleted and redirected, never admitted", async () => {
    const response = await proxy(request("/inicio", await expiredCookie()));

    expect(isRedirect(response)).toBe(true);
    expect(locationOf(response).pathname).toBe("/login");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it("tampered signature is rejected by HMAC verification", async () => {
    const response = await proxy(request("/inicio", await tamperedCookie()));

    expect(isRedirect(response)).toBe(true);
    expect(locationOf(response).pathname).toBe("/login");
  });

  it("preserves the query string in the `next` parameter", async () => {
    const response = await proxy(request("/movimientos?mes=2026-08"));
    expect(locationOf(response).searchParams.get("next")).toBe(
      "/movimientos?mes=2026-08",
    );
  });
});

describe("threat matrix: valid sessions pass", () => {
  it("admits a request carrying a valid cookie", async () => {
    const response = await proxy(request("/movimientos", await validCookie()));

    expect(isRedirect(response)).toBe(false);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("threat matrix: /login never loops", () => {
  it("renders the login screen for an unauthenticated visitor", async () => {
    const response = await proxy(request("/login?next=/inicio"));
    expect(isRedirect(response)).toBe(false);
  });

  it("redirects an already-authenticated visitor to /inicio", async () => {
    const response = await proxy(request("/login", await validCookie()));

    expect(isRedirect(response)).toBe(true);
    expect(locationOf(response).pathname).toBe(DEFAULT_AUTHENTICATED_PATH);
  });
});

describe("threat matrix: matcher-bypass attempts are all gated", () => {
  it.each(["/inicio/", "/INICIO", "/inicio/../perfil", "/perfil//", "/presupuesto"])(
    "%s is gated for an unauthenticated request",
    async (path) => {
      const response = await proxy(request(path));

      expect(isRedirect(response)).toBe(true);
      expect(locationOf(response).pathname).toBe("/login");
    },
  );
});

describe("threat matrix: `next` is never an open redirect", () => {
  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "http://evil.com",
    "javascript:alert(1)",
    "/javascript:alert(1)",
    "evil.com",
    "",
  ])("rejects %s and falls back to /inicio", (candidate) => {
    expect(sanitizeNextPath(candidate)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it.each([null, undefined])("rejects %s and falls back to /inicio", (candidate) => {
    expect(sanitizeNextPath(candidate)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("rejects a control-character-smuggled protocol-relative URL", () => {
    expect(sanitizeNextPath("/\t/evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(sanitizeNextPath("/\n/evil.com")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("refuses to bounce back to the login screen", () => {
    expect(sanitizeNextPath("/login")).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(sanitizeNextPath("/login?next=/login")).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it.each([
    "/inicio",
    "/movimientos?mes=2026-08",
    "/perfil#seccion",
    "/presupuesto",
  ])("accepts the same-origin path %s", (candidate) => {
    expect(sanitizeNextPath(candidate)).toBe(candidate);
  });
});
