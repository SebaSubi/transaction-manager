/**
 * The second sanctioned Spanish string table in `lib/domain/` (the first is
 * `MONTHS_ES` in `month.ts`).
 *
 * It lives here, and not in the UI layer, because the `financial-domain-rules`
 * spec requires the pure validation helpers to return per-field Spanish
 * messages themselves. Moving the strings out would force an error-code to
 * copy mapping layer for two screens. Copy is neutral: impersonal
 * constructions, no voseo.
 */
export const VALIDATION_MESSAGES = {
  grossRequired: "El monto es obligatorio.",
  grossNotWhole: "El monto debe ser un número entero, sin decimales.",
  grossNotPositive: "El monto debe ser mayor que cero.",
  grossTooLarge: "El monto es demasiado grande.",
  cashbackInvalid: "El cashback debe ser un porcentaje entre 0 y 100, con hasta 2 decimales.",
  typeInvalid: "El tipo de movimiento no es válido.",
  categoryRequired: "Falta elegir una categoría.",
  categoryMissing: "La categoría elegida ya no existe.",
  categoryUnavailable: "La categoría elegida ya no está disponible.",
  categoryKindMismatch: "La categoría no corresponde al tipo de movimiento.",
  memberRequired: "Falta elegir quién hizo el movimiento.",
  memberUnavailable: "La persona elegida ya no está disponible.",
  dateInvalid: "La fecha y hora no son válidas.",
  transactionNotFound: "El movimiento ya no existe.",
  saveFailed: "No se pudieron guardar los cambios.",
  deleteFailed: "No se pudo eliminar el movimiento.",
  budgetAmountInvalid: "El monto debe ser un número entero mayor que cero.",
  budgetCategoryNotExpense: "Solo se pueden presupuestar categorías de gastos.",
  budgetSaveFailed: "No se pudo guardar el presupuesto.",
  budgetRemoveFailed: "No se pudo quitar la categoría.",
  budgetCopyFailed: "No se pudo copiar el presupuesto.",
  nameRequired: "El nombre es obligatorio.",
  nameTooLong: "El nombre puede tener hasta 40 caracteres.",
  iconRequired: "Falta elegir un ícono.",
  memberNameTaken: "Ya existe una persona activa con ese nombre.",
  memberRestoreNameTaken:
    "No se puede restaurar: ya existe una persona activa con ese nombre.",
  memberMissing: "La persona ya no existe.",
  lastActiveMember: "No se puede archivar a la última persona activa.",
  categoryNameTaken: "Ya existe una categoría activa con ese nombre.",
  categoryRestoreNameTaken:
    "No se puede restaurar: ya existe una categoría activa con ese nombre.",
  categoryNotManaged: "Solo se pueden gestionar categorías de gastos.",
  archiveFailed: "No se pudo archivar.",
  restoreFailed: "No se pudo restaurar.",
  cardOrderSaveFailed: "No se pudo guardar el orden.",
} as const;
