import { redirect } from "next/navigation";

import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/redirect";

/** `/` is not a screen: the shell's first tab is Inicio. */
export default function RootPage() {
  redirect(DEFAULT_AUTHENTICATED_PATH);
}
