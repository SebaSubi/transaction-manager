/** Icon keys a household may pick for an expense category. */
export const CATEGORY_ICON_KEYS = [
  "shopping-cart",
  "key-round",
  "lightbulb",
  "flame",
  "droplet",
  "building-2",
  "house",
  "heart-pulse",
  "dumbbell",
  "users",
  "cake",
  "scissors",
  "fuel",
  "wine",
  "hand-heart",
  "church",
  "shield",
  "piggy-bank",
  "banknote",
  "gift",
  "circle-ellipsis",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

const KEY_SET: ReadonlySet<unknown> = new Set(CATEGORY_ICON_KEYS);

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return KEY_SET.has(value);
}
