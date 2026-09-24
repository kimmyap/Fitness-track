/**
 * Exercise suggestions for the muscles that are behind.
 *
 * Reads the library that the tab has already loaded — by the time this can be
 * opened, `getExerciseLibrary()` has resolved, so there is no second fetch and
 * no loading state to design around.
 *
 * It suggests, it does not add. Writing into the program from here would mean
 * choosing a day, a set target and a rep target on the user's behalf from a
 * muscle-balance number, which is a much bigger claim than "these exist and
 * they work that muscle". The name is the useful part; adding it is two taps
 * away in Train.
 */
import { useMemo } from 'react';
import styled from '@emotion/styled';
import { Modal } from '@/components';
import { getLoadedLibrary } from '@/services/exerciseLibraryService';
import { Muted } from '@/features/train/ui';
import { rankSuggestions, underworkedMuscles, type MuscleBalance } from './muscleBalance';

/** How many muscles to offer for at once. More than this is a wall, not advice. */
const MAX_MUSCLES = 4;
/** Suggestions per muscle. Three is a choice; ten is a search result. */
const PER_MUSCLE = 3;

const Group = styled.section`
  & + & {
    margin-top: ${({ theme }) => theme.space[4]};
  }
`;

const GroupHeading = styled.h3`
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  margin: 0 0 ${({ theme }) => theme.space[1]};
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Item = styled.li`
  padding: ${({ theme }) => theme.space[2]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: 0;
  }
`;

const Name = styled.span`
  font-weight: 600;
`;

const Detail = styled.span`
  display: block;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

/** "BARBELL" / "BODYWEIGHT" read as shouting in a sentence. */
function humanise(token: string): string {
  const lower = token.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function UnderworkedDrawer({
  open,
  onClose,
  balance,
  familiar,
}: {
  open: boolean;
  onClose: () => void;
  balance: MuscleBalance;
  /** Equipment tokens the user has actually logged with. */
  familiar: Set<string>;
}) {
  const groups = useMemo(() => {
    if (!open) return [];
    const library = getLoadedLibrary();
    if (!library) return [];

    return underworkedMuscles(balance)
      .slice(0, MAX_MUSCLES)
      .map((row) => ({
        muscle: row.muscle,
        sets: row.primarySets,
        options: rankSuggestions(
          library.filter((e) => e.category === 'strength' && e.primary_muscles.includes(row.muscle)),
          familiar,
        ).slice(0, PER_MUSCLE),
      }))
      .filter((g) => g.options.length > 0);
  }, [balance, familiar, open]);

  return (
    <Modal open={open} onClose={onClose} title="Train what is behind">
      {groups.length === 0 ? (
        <Muted>Nothing to suggest right now — every muscle group is inside its range or was trained today.</Muted>
      ) : (
        <>
          <Muted>
            Movements whose PRIMARY mover is a muscle you are short on this week. Add one in Train when you want it.
          </Muted>
          {groups.map((group) => (
            <Group key={group.muscle}>
              <GroupHeading>
                {group.muscle} · {group.sets} {group.sets === 1 ? 'set' : 'sets'} this week
              </GroupHeading>
              <List>
                {group.options.map((option) => (
                  <Item key={option.id}>
                    <Name>{option.name}</Name>
                    <Detail>
                      {humanise(option.equipment)} · {humanise(option.level)}
                      {option.secondary_muscles.length ? ` · also ${option.secondary_muscles.slice(0, 3).join(', ')}` : ''}
                    </Detail>
                  </Item>
                ))}
              </List>
            </Group>
          ))}
        </>
      )}
    </Modal>
  );
}
