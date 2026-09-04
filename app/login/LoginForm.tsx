"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/login";
import { INITIAL_LOGIN_STATE } from "@/lib/auth/loginState";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL_LOGIN_STATE);

  return (
    <form action={formAction} className="login__form">
      <input type="hidden" name="next" value={next} />
      <label className="login__label" htmlFor="password">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="login__input"
      />
      {state.error !== null ? (
        <p className="login__error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="login__submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
