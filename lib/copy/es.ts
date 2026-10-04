/**
 * Spanish UI copy for the entry sheet, Movimientos and Presupuesto (design
 * "Spanish UI Copy"). Neutral Spanish: impersonal constructions, no voseo.
 * Validation and server error messages live in `lib/domain/messages.ts`.
 */

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
