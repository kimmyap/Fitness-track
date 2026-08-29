/**
 * Settings — Archived / Replaced: archived custom exercises and replaced
 * built-ins, per day, each with a Restore action.
 */
import styled from '@emotion/styled';
import { Badge, Button, toast } from '@/components';
import { useCustomExercisesStore } from '@/stores';
import type { CustomExercisesMap, ExcludedBuiltInsMap } from '@/lib/types';

export interface ArchivedItem {
  day: string;
  name: string;
  /** true = replaced built-in, false = archived custom exercise. */
  builtIn: boolean;
}

/** Flatten archived customs + replaced built-ins (legacy archivedList). */
export function archivedItems(
  customExercises: CustomExercisesMap,
  excludedBuiltIns: ExcludedBuiltInsMap,
): ArchivedItem[] {
  const items: ArchivedItem[] = [];
  Object.entries(customExercises).forEach(([day, list]) => {
    list
      .filter((ex) => ex.archived === true)
      .forEach((ex) => items.push({ day, name: ex.name, builtIn: false }));
  });
  Object.entries(excludedBuiltIns).forEach(([day, names]) => {
    names.forEach((name) => items.push({ day, name, builtIn: true }));
  });
  return items;
}

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const RowList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
`;

const Name = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  overflow-wrap: anywhere;
`;

export function ArchivedSection({ items }: { items: ArchivedItem[] }) {
  const unarchiveCustomExercise = useCustomExercisesStore((s) => s.unarchiveCustomExercise);
  const restoreBuiltIn = useCustomExercisesStore((s) => s.restoreBuiltIn);

  const restore = (item: ArchivedItem) => {
    if (item.builtIn) restoreBuiltIn(item.day, item.name);
    else unarchiveCustomExercise(item.day, item.name);
    toast(`${item.name} is back on ${item.day}`);
  };

  return (
    <>
      <Note>Hidden from their day&apos;s list, but config and history are kept. Bring one back anytime.</Note>
      <RowList>
        {items.map((item) => (
          <Row key={`${item.day}:${item.name}:${item.builtIn}`}>
            <Name>
              {item.name}
              <Badge tone="neutral">{item.builtIn ? `${item.day}, replaced` : item.day}</Badge>
            </Name>
            <Button type="button" variant="secondary" onClick={() => restore(item)}>
              Restore
            </Button>
          </Row>
        ))}
      </RowList>
    </>
  );
}
