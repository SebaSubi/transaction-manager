/**
 * Spanish UI copy for the entry sheet, Movimientos and Presupuesto (design
 * "Spanish UI Copy"). Neutral Spanish: impersonal constructions, no voseo.
 * Validation and server error messages live in `lib/domain/messages.ts`.
 */

import type { CategoryIconKey } from "@/lib/domain/categoryIcons";

export const SHEET_COPY = {
  titleCreate: "Nuevo movimiento",
  titleEdit: "Editar movimiento",
  typeExpense: "Gasto",
  typeIncome: "Ingreso",
  amountAriaLabel: "Monto",
  amountPlaceholder: "0",
  cashbackLabel: "Cashback",
  cashbackNote: "Descuento sobre el monto",
  categoryLabel: "Categoría",
  memberLabel: "Quién",
  dateLabel: "Fecha y hora",
  archivedMarker: "(en archivo)",
  submitCreate: "Registrar",
  submitEdit: "Guardar cambios",
  submitPending: "Guardando…",
  deleteButton: "Eliminar movimiento",
  confirmTitle: "¿Eliminar este movimiento?",
  confirmBody: "Esta acción no se puede deshacer.",
  confirmAction: "Eliminar",
  confirmCancel: "Cancelar",
  confirmPending: "Eliminando…",
  closeAriaLabel: "Cerrar",
  noMembers: "No hay personas activas.",
} as const;

/** `Gasto final {net} · ahorro {saving}` with both amounts already formatted. */
export function cashbackPreview(net: string, saving: string): string {
  return `Gasto final ${net} · ahorro ${saving}`;
}

export const LEDGER_COPY = {
  title: "Movimientos",
  chipAll: "Todos",
  chipExpenses: "Gastos",
  chipIncome: "Ingresos",
  allCategories: "Toda categoría",
  allMembers: "Toda persona",
  fromAriaLabel: "Desde",
  toAriaLabel: "Hasta",
  sortDate: "Fecha ↓",
  sortAmountDesc: "Monto ↓",
  sortAmountAsc: "Monto ↑",
  sortAriaLabel: "Cambiar orden",
  previousMonthAriaLabel: "Mes anterior",
  nextMonthAriaLabel: "Mes siguiente",
  emptyFiltered: "Ningún movimiento coincide con los filtros.",
  clearFilters: "Limpiar filtros",
} as const;

export function ledgerCount(count: number): string {
  return count === 1 ? "1 movimiento" : `${count} movimientos`;
}

/** Suffix appended to a row's gross line: ` · 7% cashback`. */
export function cashbackTag(percent: string): string {
  return ` · ${percent}% cashback`;
}

export function ledgerEmptyMonth(monthLabel: string): string {
  return `No hay movimientos en ${monthLabel}.`;
}

export const BUDGET_COPY = {
  title: "Presupuesto",
  addToggle: "+ Agregar categoría",
  addPlaceholder: "Elegir categoría…",
  addAmount: "Monto",
  addSubmit: "Agregar",
  addCancel: "Cancelar",
  copyNothing: "No hay categorías para copiar.",
} as const;

export function budgetCopyButton(previousMonthLabel: string): string {
  return `Copiar presupuesto de ${previousMonthLabel}`;
}

export function budgetCopied(count: number): string {
  return count === 1 ? "Se copió 1 categoría." : `Se copiaron ${count} categorías.`;
}

export function budgetSpent(formattedAmount: string): string {
  return `gastado ${formattedAmount}`;
}

export function budgetRemoveAriaLabel(category: string): string {
  return `Quitar ${category}`;
}

export function budgetAmountAriaLabel(category: string): string {
  return `Monto de ${category}`;
}

export function budgetEmpty(monthLabel: string): string {
  return `Sin presupuesto para ${monthLabel}.`;
}

export const HOME_COPY = {
  greeting: "¡Buenas!",
  gridTitle: "Presupuesto del mes",
  emptyGrid: "No hay categorías con presupuesto este mes.",
  emptyGridAction: "Ir a Presupuesto",
  recentTitle: "Últimos movimientos",
  recentEmpty: "Todavía no hay movimientos.",
  cardRoleDescription: "categoría reordenable",
  dragInstructions:
    "Para reordenar una categoría, presione la barra espaciadora o Enter, muévala con las flechas y presione de nuevo la barra espaciadora o Enter para soltarla. Presione Escape para cancelar.",
} as const;

/** `Balance de octubre`: the month name is lower-cased here. */
export function balanceLabel(monthName: string): string {
  return `Balance de ${monthName.toLowerCase()}`;
}

/** `gastado $800 de $1.000` with both amounts already formatted. */
export function cardSpentLine(spent: string, budgeted: string): string {
  return `gastado ${spent} de ${budgeted}`;
}

export function announceDragStart(name: string, position: number, total: number): string {
  return `Se tomó ${name}. Posición ${position} de ${total}.`;
}

export function announceDragOver(
  name: string,
  position: number | null,
  total: number,
): string {
  return position === null
    ? `${name} no está sobre ninguna posición.`
    : `${name} está sobre la posición ${position} de ${total}.`;
}

export function announceDragEnd(
  name: string,
  position: number | null,
  total: number,
): string {
  return position === null
    ? `Se soltó ${name} sin cambios.`
    : `Se soltó ${name} en la posición ${position} de ${total}.`;
}

export function announceDragCancel(name: string, position: number, total: number): string {
  return `Se canceló el movimiento. ${name} volvió a la posición ${position} de ${total}.`;
}

export const PROFILE_COPY = {
  title: "Perfil",
  membersSection: "Personas",
  addMember: "Agregar persona",
  memberPlaceholder: "Nombre",
  memberSubmit: "Agregar",
  categoriesSection: "Categorías de gastos",
  addCategory: "Agregar categoría",
  nameLabel: "Nombre",
  iconLabel: "Ícono",
  rename: "Cambiar nombre",
  save: "Guardar",
  cancel: "Cancelar",
  archive: "Archivar",
  archiveMemberBody: "Sus movimientos se conservan. Se puede restaurar desde Archivadas.",
  archiveCategoryBody:
    "Sus movimientos y presupuestos se conservan. Se puede restaurar desde Archivadas.",
  archiveConfirm: "Archivar",
  archivePending: "Archivando…",
  saving: "Guardando…",
  archivedSection: "Archivadas",
  archivedMembers: "Personas",
  archivedCategories: "Categorías",
  restore: "Restaurar",
  restorePending: "Restaurando…",
  archivedEmpty: "No hay elementos archivados.",
  themeSection: "Tema",
  themeDark: "Oscuro",
  themeLight: "Claro",
  themeSystem: "Sistema",
} as const;

export function archiveMemberConfirmTitle(name: string): string {
  return `¿Archivar a ${name}?`;
}

export function archiveCategoryConfirmTitle(name: string): string {
  return `¿Archivar la categoría ${name}?`;
}

export const ICON_LABELS: Readonly<Record<CategoryIconKey, string>> = {
  "shopping-cart": "Carrito",
  "key-round": "Llave",
  lightbulb: "Lámpara",
  flame: "Fuego",
  droplet: "Gota",
  "building-2": "Edificio",
  house: "Casa",
  "heart-pulse": "Salud",
  dumbbell: "Pesa",
  users: "Personas",
  cake: "Pastel",
  scissors: "Tijeras",
  fuel: "Combustible",
  wine: "Copa",
  "hand-heart": "Donación",
  church: "Iglesia",
  shield: "Escudo",
  "piggy-bank": "Alcancía",
  banknote: "Billete",
  gift: "Regalo",
  "circle-ellipsis": "Otros",
};
