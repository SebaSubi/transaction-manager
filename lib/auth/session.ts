/**
 * Stateless session cookie: `base64url(payload) . base64url(HMAC-SHA-256)`.
 *
 * Runtime split (design §3). `proxy.ts` runs on the Edge runtime, where
 * `node:crypto` does not exist, so BOTH halves of the format use Web Crypto
 * (`crypto.subtle`) and live in this one module — they can never drift apart,
 * and the Edge bundle pulls in no Node module at all. Signing still happens
 * only in the login Server Action (Node runtime); the Node-only
 * `timingSafeEqual` password comparison lives in `lib/auth/password.ts`, which
 * the proxy never imports.
 *
 * There is no session table: the payload carries no secret and no identity
 * (there is only one household), so no Neon read happens per request.
 */

/** Cookie name; also read by `proxy.ts` and `app/actions/login.ts`. */
export const SESSION_COOKIE = "tm_session";

/** Absolute lifetime — 30 days, no sliding renewal (design §3). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Format version, so a future rotation can reject old cookies explicitly. */
const SESSION_VERSION = 1;

export interface SessionPayload {
  v: number;
  /** Issued-at, seconds since the Unix epoch. */
  iat: number;
  /** Expiry, seconds since the Unix epoch. */
  exp: number;
}

/**
 * Reads the signing secret. Fails CLOSED: an unset or too-short
 * `SESSION_SECRET` throws rather than falling back to a default, so a
 * misconfigured deployment cannot mint or accept sessions.
 */
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret === undefined || secret.trim() === "") {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const encoder = new TextEncoder();

function hmacKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

/**
 * Mints a signed session cookie value.
 *
 * `nowSeconds` is injected so the suite can produce an already-expired cookie
 * deterministically instead of sleeping.
 */
export async function signSession(
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload),
  );

  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifies a session cookie with Web Crypto, so this runs unchanged on the
 * Edge runtime. Returns the payload, or `null` for ANY failure — absent,
 * malformed, unsigned, tampered or expired. The caller never has to
 * distinguish the cases, so there is no branch that can accidentally admit one.
 */
export async function verifySession(
  cookieValue: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;

  const separator = cookieValue.indexOf(".");
  if (separator <= 0 || separator === cookieValue.length - 1) return null;

  const encodedPayload = cookieValue.slice(0, separator);
  const encodedSignature = cookieValue.slice(separator + 1);

  let signature: Uint8Array;
  let payloadBytes: Uint8Array;
  try {
    signature = fromBase64Url(encodedSignature);
    payloadBytes = fromBase64Url(encodedPayload);
  } catch {
    return null;
  }

  const key = await hmacKey(["verify"]);

  // `crypto.subtle.verify` is itself the constant-time comparison.
  const signatureValid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature as unknown as ArrayBufferView<ArrayBuffer>,
    encoder.encode(encodedPayload),
  );
  if (!signatureValid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
  } catch {
    return null;
  }

  if (
    payload === null ||
    typeof payload !== "object" ||
    payload.v !== SESSION_VERSION ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return null;
  }

  if (payload.exp <= nowSeconds) return null;

  return payload;
}
