/**
 * Recovery & weekly balance: what you have trained in the last 7 rolling days,
 * against the 10-20 working-sets benchmark, and what is recovered enough to
 * train next.
 *
 * LAZY LIBRARY. The muscle data lives in the 1.2 MB exercise library, which
 * CLAUDE.md requires to stay a dynamic import. Same approach as
 * `MuscleVolumeSection`: nothing is imported from it at module scope, and
 * `getExerciseLibrary()` is called on mount — so this costs nothing until the
 * tab is actually opened, and Today (the landing route) never pulls it.
 *
 * NO COLOUR-ONLY MEANING. Every status carries an icon AND a word AND a set
 * count; the tint is the third signal, never the only one. Groups are rendered
 * as headed sections rather than a 17-row list so the answer ("what is behind")
 * is readable without counting.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { AlertTriangle, Activity, CheckCircle2, ChevronDown, CircleSlash, Flame, HelpCircle, Moon, Wand2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@/components';
import { useCustomExercisesStore, useEntriesStore, useMuscleMapStore, useProgramStore } from '@/stores';
import { lookupExercise } from '@/services/exerciseLibraryService';
import { useExerciseLibrary } from '@/services/useExerciseLibrary';
import { CardTitle, Muted, Row, Stack } from '@/features/train/ui';
import { exercisesForDay } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import { toMuscleLookup } from './chartData';
import {
  BALANCE_WINDOW_DAYS,
  familiarEquipment,
  WEEKLY_SETS_MAX,
  WEEKLY_SETS_MIN,
  muscleBalance,
  programMuscles,
  underworkedMuscles,
  type MuscleBalanceRow,
} from './muscleBalance';
import { resolveMuscle } from './muscleResolve';
import { UnmatchedMapper } from './UnmatchedMapper';
import { UnderworkedDrawer } from './UnderworkedDrawer';

const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  margin: 0;
`;

const GroupHeading = styled.h3`
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.mutedForeground};
  margin: 0;
`;

const MuscleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[2]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-of-type {
    border-bottom: 0;
  }
`;

const MuscleName = styled.span`
  font-weight: 600;
`;

const Meta = styled.span`
  display: block;
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-variant-numeric: tabular-nums;
`;

/**
 * Set count against the benchmark. A bar, not a ring: the question is "how far
 * along a range", and the range has a top as well as a bottom.
 */
const Track = styled.div`
  position: relative;
  width: 84px;
  height: 8px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.muted};
  overflow: hidden;
  flex: none;
`;

const Fill = styled.div<{ pct: number; tone: 'under' | 'optimal' | 'over' }>`
  width: ${({ pct }) => pct}%;
  height: 100%;
  background: ${({ theme, tone }) =>
    tone === 'over'
      ? theme.colors.destructiveText
      : tone === 'optimal'
        ? theme.colors.accentText
        : theme.colors.primary};
`;

const WarnCard = styled(Card)`
  border-color: ${({ theme }) => theme.colors.destructive};
`;

const WarnTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.destructiveText};
`;

interface Group {
  id: string;
  heading: string;
  blurb: string;
  rows: MuscleBalanceRow[];
  /** Rendered collapsed: true for lists that are long AND mostly zeroes. */
  collapsed?: boolean;
}

/*
 * `details` rather than a state toggle: it is open/closed markup the browser
 * already handles, including keyboard and screen-reader semantics. The summary
 * is padded to a 44px target because it is the only control on the row.
 */
const Collapsible = styled.details`
  > summary {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[2]};
    min-height: 44px;
    cursor: pointer;
  }

  /*
   * A summary set to display:flex loses the browser's disclosure triangle —
   * Chromium only draws it for display: list-item — so the row looked like
   * plain text with nothing to say it opens. The chevron below IS the
   * affordance, and this hides the marker in engines that still draw one so
   * there are never two.
   */
  > summary::-webkit-details-marker,
  > summary::marker {
    display: none;
    content: '';
  }

  > summary:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.ring};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

/** Rotates to point up when the section is open. Motion is gated below. */
const Chevron = styled(ChevronDown)`
  margin-left: auto;
  flex: none;
  color: ${({ theme }) => theme.colors.mutedForeground};

  details[open] & {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 150ms ease;
  }
`;

/** Days-since, phrased the way a person would say it. */
function recoveryPhrase(row: MuscleBalanceRow): string {
  if (row.daysSince === null) return 'no working sets';
  if (row.daysSince === 0) return 'trained today';
  if (row.daysSince === 1) return 'trained yesterday';
  return `${row.daysSince} days ago`;
}

function SetBar({ row }: { row: MuscleBalanceRow }) {
  // A zero-length bar reads as a rendering fault, and 13 of them read as a
  // broken page. The number beside it already says zero.
  if (row.primarySets === 0) return null;
  const tone = row.volume === 'over' ? 'over' : row.volume === 'optimal' ? 'optimal' : 'under';
  const pct = Math.min(100, Math.round((row.primarySets / WEEKLY_SETS_MAX) * 100));
  return (
    <Track
      role="img"
      aria-label={`${row.primarySets} of ${WEEKLY_SETS_MIN}-${WEEKLY_SETS_MAX} sets`}
    >
      <Fill pct={pct} tone={tone} />
    </Track>
  );
}

function MuscleLine({ row }: { row: MuscleBalanceRow }) {
  return (
    <MuscleRow>
      <span>
        <MuscleName>{row.muscle}</MuscleName>
        <Meta>
          {/* "0 sets · no working sets" said it twice. */}
          {row.primarySets === 0
            ? `No sets in the last ${BALANCE_WINDOW_DAYS} days`
            : `${row.primarySets} ${row.primarySets === 1 ? 'set' : 'sets'} · ${recoveryPhrase(row)}`}
          {row.secondarySets > 0 ? ` · ${row.secondarySets} assisting` : ''}
        </Meta>
      </span>
      <SetBar row={row} />
    </MuscleRow>
  );
}

export function RecoveryTab() {
  const entries = useEntriesStore((s) => s.entries);
  const muscleMap = useMuscleMapStore((s) => s.muscleMap);
  const programDays = useProgramStore((s) => s.days);
  const order = useProgramStore((s) => s.order);
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const { status, library } = useExerciseLibrary();
  const ready = status === 'ready';
  const failed = status === 'failed';
  const [drawerOpen, setDrawerOpen] = useState(false);

  /*
   * Notes by exercise name. `AddExerciseSection` writes "Targets: <muscles>"
   * when a custom exercise is created from the library, so for those the answer
   * was recorded at creation and the resolver needs to guess nothing.
   */
  const notesByExercise = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const list of Object.values(customExercises)) {
      for (const ex of list) map.set(ex.name, ex.notes);
    }
    return map;
  }, [customExercises]);

  const resolve = useMemo(() => {
    if (!library) return undefined;
    return (name: string) => resolveMuscle(name, library, notesByExercise.get(name));
  }, [library, notesByExercise]);

  const balance = useMemo(() => {
    if (!ready) return null;
    return muscleBalance(entries, toMuscleLookup(), muscleMap, new Date(), resolve);
  }, [entries, muscleMap, ready, resolve]);

  /*
   * Which muscles the program COULD train. Derived from the real program, not
   * from the window — "you did no sets" and "nothing you do trains this" are
   * different answers, and reading the second off the first told a lifter with
   * a week's rest that Chest was not in their program.
   */
  const covered = useMemo(() => {
    if (!ready) return new Set<string>();
    const names = programDays.flatMap((day) =>
      exercisesForDay(day, DAYS, customExercises, excludedBuiltIns, order[day]).map((e) => e.name),
    );
    return programMuscles(names, toMuscleLookup(), muscleMap, resolve);
  }, [customExercises, excludedBuiltIns, muscleMap, order, programDays, ready, resolve]);

  /* What the drawer may suggest: only equipment this history shows you use. */
  const familiar = useMemo(
    () => (ready ? familiarEquipment(entries, (name) => lookupExercise(name)?.equipment) : new Set<string>()),
    [entries, ready],
  );

  if (failed || !balance) {
    return (
      <Card as="section">
        <EmptyState
          icon={failed ? AlertTriangle : Activity}
          title={failed ? 'Muscle data unavailable offline' : 'Loading exercise data…'}
          description={
            failed
              ? 'The exercise library has not been cached on this device yet. Open this tab once while online and it will work offline afterwards.'
              : 'The muscle map loads on demand, so it only downloads when you open this tab.'
          }
        />
      </Card>
    );
  }

  const behind = balance.rows.filter((r) => r.volume === 'under' || r.volume === 'untrained');
  const optimal = balance.rows.filter((r) => r.volume === 'optimal');
  const over = balance.rows.filter((r) => r.volume === 'over');
  const trained = balance.rows.filter((r) => r.primarySets > 0);

  const groups: Group[] = [
    {
      id: 'over',
      heading: 'High fatigue',
      blurb: `Above ${WEEKLY_SETS_MAX} sets this week. Not a problem on its own — worth watching if these lifts stop moving.`,
      rows: over,
    },
    {
      id: 'optimal',
      heading: 'Optimal volume',
      blurb: `Inside the ${WEEKLY_SETS_MIN}-${WEEKLY_SETS_MAX} set range.`,
      rows: optimal,
    },
    {
      id: 'behind',
      heading: 'Under-worked',
      blurb: `Below ${WEEKLY_SETS_MIN} sets in the last ${BALANCE_WINDOW_DAYS} days.`,
      rows: behind.filter((r) => r.primarySets > 0),
    },
    {
      id: 'rested',
      heading: 'Not trained this week',
      blurb: `Your program trains these, but nothing in the last ${BALANCE_WINDOW_DAYS} days did.`,
      rows: behind.filter((r) => r.primarySets === 0 && covered.has(r.muscle)),
    },
    {
      id: 'absent',
      heading: 'Not in your program',
      blurb:
        'Nothing in your current plan has these as the primary mover. That may be deliberate — but if you want them, nothing covers them.',
      rows: behind.filter((r) => r.primarySets === 0 && !covered.has(r.muscle)),
      collapsed: true,
    },
  ];

  const icons: Record<string, typeof Flame> = {
    over: Flame,
    optimal: CheckCircle2,
    behind: Activity,
    rested: Moon,
    absent: CircleSlash,
  };

  return (
    <Stack gap={4}>
      <Card as="section">
        <Stack gap={2}>
          <SectionTitle>Last {BALANCE_WINDOW_DAYS} days</SectionTitle>
          <Muted>
            Working sets where each muscle is the primary mover, against the {WEEKLY_SETS_MIN}-{WEEKLY_SETS_MAX}{' '}
            sets-per-week range from the hypertrophy literature. General guidance for trained lifters, not a
            prescription for you. Rolling, so nothing resets on a Monday.
          </Muted>
          <Row wrap>
            <Badge tone="neutral">{trained.length} of 17 muscles trained</Badge>
            <Badge tone="neutral">{balance.attributedSets} sets counted</Badge>
          </Row>
        </Stack>
      </Card>

      {balance.attributedSets === 0 && balance.unattributedSets === 0 ? (
        <Card as="section">
          <EmptyState
            icon={Moon}
            title="Nothing logged in the last 7 days"
            description={
              'This reads a rolling week, so it is empty after time off rather than wrong. Log a set and the balance fills in from that day.'
            }
          />
        </Card>
      ) : null}

      {balance.autoMatched.length > 0 ? (
        <Card as="section">
          {/*
            * Collapsed by default: this card CONFIRMS rather than asks. The red
            * "not counted" card below stays open because it needs a decision;
            * five entries of label + reasoning + select above the balance
            * itself buries the thing the tab is for.
            */}
          <Collapsible>
            <summary>
              <Wand2 size={18} aria-hidden="true" />
              <CardTitle>
                {balance.autoMatched.length} matched automatically
              </CardTitle>
              <Chevron size={18} aria-hidden="true" />
            </summary>
            <Stack gap={2}>
            <Muted>
              These are not in the library by name, so the muscle was worked out from what you
              logged. They ARE counted above. Change any that look wrong — your choice is stored
              and wins from then on.
            </Muted>
            <UnmatchedMapper unmatched={balance.autoMatched} />
            </Stack>
          </Collapsible>
        </Card>
      ) : null}

      {balance.unmatched.length > 0 ? (
        <WarnCard as="section">
          <Stack gap={2}>
            <WarnTitle>
              <HelpCircle size={18} aria-hidden="true" />
              <CardTitle>
                {balance.unattributedSets} {balance.unattributedSets === 1 ? 'set is' : 'sets are'} not counted
              </CardTitle>
            </WarnTitle>
            <Muted>
              These exercises are not in the library, so nothing above knows what they work. Until you map them, the
              muscles they train look untrained.
            </Muted>
            <UnmatchedMapper unmatched={balance.unmatched} />
          </Stack>
        </WarnCard>
      ) : null}

      {groups
        .filter((g) => g.rows.length > 0)
        .map((group) => {
          const Icon = icons[group.id] ?? Activity;
          const body = (
            <>
              <Muted>{group.blurb}</Muted>
              <div>
                {group.rows.map((row) => (
                  <MuscleLine key={row.muscle} row={row} />
                ))}
              </div>
            </>
          );
          const heading = (
            <>
              <Icon size={16} aria-hidden="true" />
              <GroupHeading>
                {group.heading} ({group.rows.length})
              </GroupHeading>
            </>
          );

          return (
            <Card as="section" key={group.id}>
              {group.collapsed ? (
                <Collapsible>
                  <summary>
                    {heading}
                    <Chevron size={18} aria-hidden="true" />
                  </summary>
                  <Stack gap={2}>{body}</Stack>
                </Collapsible>
              ) : (
                <Stack gap={2}>
                  <Row>{heading}</Row>
                  {body}
                </Stack>
              )}
            </Card>
          );
        })}

      {underworkedMuscles(balance).length > 0 ? (
        <Button fullWidth onClick={() => setDrawerOpen(true)}>
          Find exercises for what is behind
        </Button>
      ) : null}

      <UnderworkedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        balance={balance}
        familiar={familiar}
      />
    </Stack>
  );
}
