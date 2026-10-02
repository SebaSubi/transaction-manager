import Link from "next/link";

/** A message with an optional action link. */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action !== undefined ? (
        <Link href={action.href} className="empty-state__action">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
