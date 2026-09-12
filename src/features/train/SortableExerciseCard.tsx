/**
 * Drag-and-drop wrapper around ExerciseCard.
 *
 * Replaces the old up/down chevron pair, which sat directly above a button with
 * `aria-expanded` and above a real <select>, so it read as a dropdown or
 * expander and got clicked by accident during data entry. A GripVertical handle
 * cannot be mistaken for either.
 *
 * dnd-kit rather than the HTML5 drag API: this app is used on a phone, and
 * HTML5 drag-and-drop does not fire on touch at all. dnd-kit's KeyboardSensor
 * also keeps reordering reachable without a pointer (focus the handle, Space to
 * lift, arrows to move, Space to drop), which a drag-only control would lose.
 */
import styled from '@emotion/styled';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ExerciseCard } from './ExerciseCard';
import type { ExerciseCardProps } from './ExerciseCard';

const Handle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${({ theme }) => theme.touchTarget};
  height: ${({ theme }) => theme.touchTarget};
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.mutedForeground};
  cursor: grab;
  touch-action: none;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  &:active {
    cursor: grabbing;
  }
`;

const Wrap = styled.div`
  position: relative;
`;

export type SortableExerciseCardProps = { id: string } & Omit<ExerciseCardProps, 'dragHandle' | 'dragging'>;

export function SortableExerciseCard({ id, ...cardProps }: SortableExerciseCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <Wrap
      ref={setNodeRef}
      data-exercise={id}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }}
    >
      <ExerciseCard
        {...cardProps}
        dragging={isDragging}
        dragHandle={
          <Handle
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${cardProps.exercise.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} aria-hidden="true" />
          </Handle>
        }
      />
    </Wrap>
  );
}
