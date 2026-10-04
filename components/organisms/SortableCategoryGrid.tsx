"use client";

import { startTransition, useOptimistic, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { reorderCardsAction } from "@/app/actions/cardOrder";
import { SortableCategoryCard } from "@/components/organisms/SortableCategoryCard";
import { FieldError } from "@/components/ui/FieldError";
import {
  HOME_COPY,
  announceDragCancel,
  announceDragEnd,
  announceDragOver,
  announceDragStart,
} from "@/lib/copy/es";
import { moveId, type HomeCardView } from "@/lib/view/home";

/**
 * Drag-to-reorder grid. The stable `DndContext` id keeps the `aria-describedby`
 * target identical on the server and during hydration. The new order applies
 * optimistically; a failed save reverts it and shows the message below.
 */
export function SortableCategoryGrid({ cards }: { cards: readonly HomeCardView[] }) {
  const serverIds = cards.map((card) => card.id);
  const [ids, setIds] = useOptimistic<number[], number[]>(serverIds, (_, next) => next);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(cards.map((card) => [card.id, card]));
  const nameOf = (id: string | number) => byId.get(Number(id))?.name ?? "";
  const positionOf = (id: string | number) => {
    const index = ids.indexOf(Number(id));
    return index === -1 ? null : index + 1;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      announceDragStart(nameOf(active.id), positionOf(active.id) ?? 1, ids.length),
    onDragOver: ({ active, over }) =>
      announceDragOver(
        nameOf(active.id),
        over === null ? null : positionOf(over.id),
        ids.length,
      ),
    onDragEnd: ({ active, over }) =>
      announceDragEnd(
        nameOf(active.id),
        over === null ? null : positionOf(over.id),
        ids.length,
      ),
    onDragCancel: ({ active }) =>
      announceDragCancel(nameOf(active.id), positionOf(active.id) ?? 1, ids.length),
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over === null || active.id === over.id) return;
    const next = moveId(ids, Number(active.id), Number(over.id));
    startTransition(async () => {
      setIds(next);
      const result = await reorderCardsAction(next);
      if (result.status === "error") startTransition(() => setError(result.message));
    });
  }

  return (
    <div className="home-grid-wrap">
      <DndContext
        id="home-card-grid"
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: HOME_COPY.dragInstructions },
        }}
        onDragStart={() => setError(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="home-grid">
            {ids.map((id) => {
              const card = byId.get(id);
              return card === undefined ? null : (
                <SortableCategoryCard key={id} card={card} />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <FieldError message={error} />
    </div>
  );
}
