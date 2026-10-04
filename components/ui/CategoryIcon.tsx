import {
  Banknote,
  Building2,
  Cake,
  Church,
  CircleEllipsis,
  Droplet,
  Dumbbell,
  Flame,
  Fuel,
  Gift,
  HandHeart,
  HeartPulse,
  House,
  KeyRound,
  Lightbulb,
  PiggyBank,
  Scissors,
  Shield,
  ShoppingCart,
  Tag,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { isCategoryIconKey, type CategoryIconKey } from "@/lib/domain/categoryIcons";

/**
 * Static map of the pickable category icon keys (`CATEGORY_ICON_KEYS`) to
 * bundled lucide components; the record type makes the compiler enforce exactly
 * those keys. Nothing is imported dynamically and nothing is
 * fetched at runtime, so the whole icon set never reaches the bundle.
 */
const ICONS: Readonly<Record<CategoryIconKey, LucideIcon>> = {
  "shopping-cart": ShoppingCart,
  "key-round": KeyRound,
  lightbulb: Lightbulb,
  flame: Flame,
  droplet: Droplet,
  "building-2": Building2,
  house: House,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  users: Users,
  cake: Cake,
  scissors: Scissors,
  fuel: Fuel,
  wine: Wine,
  "hand-heart": HandHeart,
  church: Church,
  shield: Shield,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  gift: Gift,
  "circle-ellipsis": CircleEllipsis,
};

/** Resolves a stored icon name, falling back to `Tag` for an unknown one. */
export function CategoryIcon({
  name,
  size = 20,
  color,
}: {
  name: string;
  size?: number;
  /** A `var(--accent-N)` reference from `categoryColor()`. */
  color?: string;
}) {
  const component = isCategoryIconKey(name) ? ICONS[name] : Tag;
  return <Icon as={component} size={size} color={color} />;
}
