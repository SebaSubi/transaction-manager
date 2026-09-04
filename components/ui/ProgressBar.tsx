/**
 * Budget progress bar.
 *
 * `barPct` arrives already clamped to 0..100 by `budgetProgress()`; the label
 * percentage is uncapped and is rendered by the caller, not here. `overBudget`
 * and `hasBudget` pick the colour via CSS custom properties, so no theme value
 * is read during render.
 */
export function ProgressBar({
  barPct,
  overBudget = false,
  hasBudget = true,
  label,
}: {
  barPct: number;
  overBudget?: boolean;
  hasBudget?: boolean;
  label?: string;
}) {
  const state = !hasBudget ? "neutral" : overBudget ? "over" : "under";

  return (
    <div
      className={`progress progress--${state}`}
      role="progressbar"
      aria-valuenow={barPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress__fill" style={{ width: `${barPct}%` }} />
    </div>
  );
}
