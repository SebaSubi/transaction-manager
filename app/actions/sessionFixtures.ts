import { SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/session";

/** Test-only session cookie values for the "rejected session" matrix. */
export async function expiredSession(): Promise<string> {
  return signSession(Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SECONDS - 10);
}

export async function tamperedSession(): Promise<string> {
  const [payload, signature] = (await signSession()).split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.exp += 60 * 60 * 24 * 365;
  const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}
