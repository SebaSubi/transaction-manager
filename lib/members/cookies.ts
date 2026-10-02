/**
 * Last-used member cookie (design Decision 8).
 *
 * Kept out of the `"use server"` actions because those may export async
 * functions only. Written by the create and update transaction actions after a
 * successful write; read by the shell layout to preselect "Quién".
 */
export const LAST_MEMBER_COOKIE = "tm_last_member";

/** One year: a durable per-device preference. */
export const LAST_MEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
