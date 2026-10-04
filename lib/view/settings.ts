import type { CategoryRow } from "@/lib/db/repositories/categories.repository";
import type { MemberRow } from "@/lib/db/repositories/members.repository";
import { categoryColor } from "@/lib/domain/categories";

export interface SettingsCategoryView {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface SettingsMemberView {
  id: number;
  name: string;
}

export function toSettingsCategoryView(row: CategoryRow): SettingsCategoryView {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: categoryColor(row.colorIndex),
  };
}

export function toSettingsMemberView(row: MemberRow): SettingsMemberView {
  return { id: row.id, name: row.name };
}
