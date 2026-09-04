import type { TransactionType } from "@/lib/domain/types";

export interface SeedCategory {
  name: string;
  kind: TransactionType;
  icon: string;
}

/**
 * The 18 expense categories, in the source design's order (obs #59). The order
 * matters: `color_index` is assigned from it, so a category's accent colour
 * stays stable across re-seeds.
 *
 * `icon` values are `lucide-react` icon names, ported from the prototype's
 * `iconUrl()` map. The prototype fetched each one from unpkg at render time;
 * they are bundled now.
 */
export const SEED_EXPENSE_CATEGORIES: readonly SeedCategory[] = [
  { name: "Super", kind: "expense", icon: "shopping-cart" },
  { name: "Alquiler", kind: "expense", icon: "key-round" },
  { name: "Luz", kind: "expense", icon: "lightbulb" },
  { name: "Gas", kind: "expense", icon: "flame" },
  { name: "Agua", kind: "expense", icon: "droplet" },
  { name: "Expensas", kind: "expense", icon: "building-2" },
  { name: "Casa", kind: "expense", icon: "house" },
  { name: "Salud", kind: "expense", icon: "heart-pulse" },
  { name: "Deporte", kind: "expense", icon: "dumbbell" },
  { name: "Chicas", kind: "expense", icon: "users" },
  { name: "Cumple", kind: "expense", icon: "cake" },
  { name: "Peluquería", kind: "expense", icon: "scissors" },
  { name: "Nafta", kind: "expense", icon: "fuel" },
  { name: "Date and fun time", kind: "expense", icon: "wine" },
  { name: "Ofrendas", kind: "expense", icon: "hand-heart" },
  { name: "Diezmo", kind: "expense", icon: "church" },
  { name: "Fondo de emergencia", kind: "expense", icon: "shield" },
  { name: "Ahorro", kind: "expense", icon: "piggy-bank" },
];

/**
 * The 3 income categories. They are rows in the SAME table, discriminated by
 * `kind`, not a second table. The add/edit sheet selects between the two sets
 * by transaction type, so income transactions are unrecordable without these.
 */
export const SEED_INCOME_CATEGORIES: readonly SeedCategory[] = [
  { name: "Sueldo", kind: "income", icon: "banknote" },
  { name: "Regalo", kind: "income", icon: "gift" },
  { name: "Otro", kind: "income", icon: "circle-ellipsis" },
];

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  ...SEED_EXPENSE_CATEGORIES,
  ...SEED_INCOME_CATEGORIES,
];

export const SEED_MEMBERS: readonly string[] = ["Sofi", "Mati"];
