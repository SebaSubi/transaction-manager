import { describe, expect, it } from "vitest";

import { assertPooledNeonUrl } from "@/lib/db/pooledUrl";

const POOLED_URL =
  "postgres://user:pass@ep-cool-forest-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("assertPooledNeonUrl", () => {
  it("accepts a well-formed pooled connection string", () => {
    expect(() => assertPooledNeonUrl(POOLED_URL)).not.toThrow();
  });

  it("rejects a direct (non-pooler) Neon host", () => {
    const directUrl =
      "postgres://user:pass@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(() => assertPooledNeonUrl(directUrl)).toThrowError(/pooled\/HTTP endpoint/);
  });

  it("rejects a non-Neon host", () => {
    const otherUrl = "postgres://user:pass@db.example.com/neondb?sslmode=require";
    expect(() => assertPooledNeonUrl(otherUrl)).toThrowError(/not a Neon host/);
  });

  it("rejects a pooled host missing sslmode=require", () => {
    const noSslUrl =
      "postgres://user:pass@ep-cool-forest-12345-pooler.us-east-2.aws.neon.tech/neondb";
    expect(() => assertPooledNeonUrl(noSslUrl)).toThrowError(/sslmode=require/);
  });

  it("rejects a pooled host with sslmode set to something other than require", () => {
    const wrongSslUrl =
      "postgres://user:pass@ep-cool-forest-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=prefer";
    expect(() => assertPooledNeonUrl(wrongSslUrl)).toThrowError(/sslmode=require/);
  });

  it("rejects an unparsable URL", () => {
    expect(() => assertPooledNeonUrl("not-a-url")).toThrowError(/not a valid URL/);
  });

  it("rejects a non-postgres protocol", () => {
    const httpUrl =
      "https://user:pass@ep-cool-forest-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(() => assertPooledNeonUrl(httpUrl)).toThrowError(/postgres:\/\/ or postgresql:\/\//);
  });
});
