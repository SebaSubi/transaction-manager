import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

/** Presentational atom: props in, callbacks out. No repository import. */
export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`btn btn--${variant} ${className}`.trim()} {...rest} />;
}
