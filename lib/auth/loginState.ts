/**
 * Login form state, kept out of `app/actions/login.ts` because a `"use server"`
 * module may export async functions only.
 */
export interface LoginState {
  /** Spanish product copy shown under the field; `null` means "no error yet". */
  error: string | null;
}

export const INITIAL_LOGIN_STATE: LoginState = { error: null };

/**
 * Deliberately generic. A message distinguishing "wrong password" from
 * "no password configured" would tell an attacker which of the two they hit.
 */
export const GENERIC_LOGIN_ERROR = "Contraseña incorrecta.";
