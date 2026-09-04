import { LoginForm } from "@/app/login/LoginForm";

export const metadata = {
  title: "Ingresar",
};

/**
 * Public route: the proxy lets `/login` through explicitly. Reads the
 * `next` parameter here and hands it to the form as a hidden field; it is
 * re-sanitized server-side in the action, never trusted from the URL.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" ? rawNext : "";

  return (
    <main className="login">
      <h1 className="login__title">Transaction Manager</h1>
      <p className="login__subtitle">Ingresá la contraseña del hogar</p>
      <LoginForm next={next} />
    </main>
  );
}
