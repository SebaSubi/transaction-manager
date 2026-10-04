import { SHEET_COPY } from "@/lib/copy/es";

/** The "(en archivo)" marker shown next to an archived category or member. */
export function ArchivedTag() {
  return <span className="archived-tag">{SHEET_COPY.archivedMarker}</span>;
}
