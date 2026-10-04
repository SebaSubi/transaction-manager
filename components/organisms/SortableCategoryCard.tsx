"use client";

import { useSortable } from "@dnd-kit/sortable";

import { HomeCategoryCard } from "@/components/molecules/HomeCategoryCard";
import { HOME_COPY } from "@/lib/copy/es";
import type { HomeCardView } from "@/lib/view/home";

/**
 * `useSortable` wrapper around the presentational card. The transform string is
 * built by hand so `@dnd-kit/utilities` is not a direct dependency.
 */
export function SortableCategoryCard({ card }: { card: HomeCardView }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      attributes: { roleDescription: HOME_COPY.cardRoleDescription },
    });

  return (
    <HomeCategoryCard
      ref={setNodeRef}
      card={card}
      dragging={isDragging}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      {...attributes}
      {...listeners}
    />
  );
}
