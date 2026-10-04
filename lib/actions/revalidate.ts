import { revalidatePath } from "next/cache";

/**
 * Member and category mutations change data rendered on every shell tab: the
 * sheet pickers (all tabs), Movimientos filters and labels, Presupuesto labels
 * and the Inicio grid. Literal paths, no `type` argument.
 */
export function revalidateShellTabs(): void {
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  revalidatePath("/presupuesto");
  revalidatePath("/movimientos");
}
