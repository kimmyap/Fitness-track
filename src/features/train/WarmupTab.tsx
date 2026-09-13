/**
 * Warm-up tab (legacy renderWarmup): mark-complete toggle + 7-day WeekStrip +
 * a warm-up drawn for today rather than three static lists.
 *
 * Three things make it adapt:
 * - FOCUS. `DAY_PLAN` already knows what today is, so only the block that preps
 *   it is shown. The other blocks stay reachable under "Other routines" —
 *   nothing is hidden, it just isn't in your way.
 * - ROTATION. Movements are drawn from pools, seeded by the date, so it varies
 *   day to day while staying stable within a day (see warmupPlan.ts).
 * - LENGTH. Quick or Full, changing how much of the block you get.
 *
 * Tick state survives a reload via `gymlog:warmupProgress`, which stores the
 * ticks AND the shuffle nonce they were made against — restoring one without
 * the other would check off movements of a different draw. It is scratch
 * state: a value from any other day is discarded on read, and it is the one
 * key deliberately absent from both backup payloads (see
 * `getWarmupProgress`). What counts as history is still the legacy completion
 * entry, `{ type: 'warmup', date }`, unchanged shape.
 *
 * Legacy quirk preserved: toggling warm-up does NOT run the achievements
 * check (unlike the core toggle).
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Circle, CircleCheck, Shuffle } from 'lucide-react';
import { Button, Card, SegmentedTabs, WeekStrip, toast } from '@/components';
import { useEntriesStore } from '@/stores';
import { isoDate } from '@/lib/domain';
import { getWarmupProgress, saveWarmupProgress } from '@/lib/storage';
import { DAY_PLAN, WARMUP_BLOCKS, WARMUP_FOCUS_LABEL, WARMUP_WHY, randomHype } from '@/lib/program';
import type { WarmupFocus } from '@/lib/program';
import { CardTitle, Muted, Row, SetRow, SrOnly, Stack, last7Dates } from './ui';
import {
  WARMUP_DURATION_LABEL,
  buildWarmupPlan,
  warmupFocusForDay,
  type WarmupDuration,
  type WarmupPlanItem,
} from './warmupPlan';

export const CompleteButton = styled(Button)<{ done: boolean }>`
  ${({ theme, done }) =>
    done
      ? `background: ${theme.colors.accent}; color: ${theme.colors.onAccent};`
      : ''};
`;

const DURATIONS: WarmupDuration[] = ['quick', 'full'];

/*
 * Shuffle rides with the progress count, not with the duration toggle: at
 * 375px the two toggle labels already fill the card, and sitting it alongside
 * them overlapped "Full · ~10 min".
 */
const ProgressRow = styled(Row)`
  justify-content: space-between;
`;

const ShuffleButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  flex-shrink: 0;
`;

/**
 * One movement, tickable.
 *
 * A real <button> filling the row: the whole line is the target, which is what
 * you want with a phone in one hand. Ticked state is carried by the icon and by
 * aria-pressed, never by the green alone.
 */
const ItemButton = styled.button<{ ticked: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[1]}`};
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme, ticked }) => (ticked ? theme.colors.mutedForeground : theme.colors.cardForeground)};
  font: inherit;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  text-align: left;
  cursor: pointer;

  &:first-of-type {
    border-top: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.muted};
  }

  svg {
    flex-shrink: 0;
    color: ${({ theme, ticked }) => (ticked ? theme.colors.accentText : theme.colors.mutedForeground)};
  }
`;

const ItemName = styled.span`
  flex: 1;
  min-width: 0;
  font-weight: 500;
`;

const ItemDetail = styled.span`
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

/** Native disclosure: no JS, no focus trap to get wrong, keyboard for free. */
const OtherRoutines = styled.details`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.space[4]};

  > summary {
    display: flex;
    align-items: center;
    min-height: ${({ theme }) => theme.touchTarget};
    font-family: ${({ theme }) => theme.typography.display};
    font-size: ${({ theme }) => theme.typography.fontSizes.md};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.cardForeground};
    cursor: pointer;
  }
`;

const ProgressText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

export function WarmupTab() {
  const todayIso = isoDate();
  const entries = useEntriesStore((s) => s.entries);
  const toggleCompletion = useEntriesStore((s) => s.toggleCompletion);
  const doneToday = entries.some((e) => 'type' in e && e.type === 'warmup' && e.date === todayIso);

  const todayPlan = DAY_PLAN[new Date().getDay()];
  const focus = warmupFocusForDay(todayPlan?.tab);

  /*
   * Restored together, and that pairing is the point: the plan is drawn from a
   * `${date}:${shuffles}` seed, so ticks without the nonce they were made
   * against would check off movements of a different draw.
   */
  const [duration, setDuration] = useState<WarmupDuration>('full');
  const restored = useState(() => getWarmupProgress(todayIso))[0];
  const [shuffles, setShuffles] = useState(() => restored?.shuffles ?? 0);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(restored?.items ?? []));

  const persist = (items: ReadonlySet<string>, nonce: number) => {
    void saveWarmupProgress({ date: todayIso, shuffles: nonce, items: [...items] });
  };

  const plan = useMemo(
    () => buildWarmupPlan({ focus, duration, seed: `${todayIso}:${shuffles}` }),
    [focus, duration, todayIso, shuffles],
  );

  const tickedCount = plan.sections.reduce(
    (n, section) => n + section.items.filter((item) => ticked.has(item.key)).length,
    0,
  );
  const allTicked = tickedCount === plan.itemCount;

  /* Computed outside the updater: a write is a side effect, and React calls
     updaters twice in StrictMode. */
  const toggleItem = (item: WarmupPlanItem) => {
    const next = new Set(ticked);
    if (!next.delete(item.key)) next.add(item.key);
    setTicked(next);
    persist(next, shuffles);
  };

  /* A new draw means the old ticks describe movements you are no longer doing. */
  const reshuffle = () => {
    const nonce = shuffles + 1;
    setShuffles(nonce);
    setTicked(new Set<string>());
    persist(new Set<string>(), nonce);
  };

  const stripDays = last7Dates().map((date) => ({
    date,
    done: entries.some((e) => 'type' in e && e.type === 'warmup' && e.date === date),
  }));

  const otherFocuses = (Object.keys(WARMUP_BLOCKS) as WarmupFocus[]).filter((f) => f !== focus);

  return (
    <Stack gap={3}>
      <Card>
        <Stack gap={2}>
          <CardTitle>Today&apos;s Warm-up</CardTitle>
          <Muted>
            {plan.focusLabel}
            {todayPlan ? ` · today is ${todayPlan.label}` : ''}
          </Muted>

          <SegmentedTabs
            aria-label="Warm-up length"
            tabs={DURATIONS.map((id) => ({ id, label: WARMUP_DURATION_LABEL[id] }))}
            value={duration}
            onChange={(id) => setDuration(id as WarmupDuration)}
          />

          <ProgressRow>
            <ProgressText>
              {doneToday
                ? 'Marked complete'
                : `${tickedCount} of ${plan.itemCount} ticked off${allTicked ? ' — log it' : ''}`}
            </ProgressText>
            <ShuffleButton variant="ghost" onClick={reshuffle}>
              <Shuffle size={16} aria-hidden="true" /> Shuffle
            </ShuffleButton>
          </ProgressRow>

          <CompleteButton
            fullWidth
            done={doneToday}
            onClick={() => {
              const nowDone = toggleCompletion('warmup', todayIso);
              if (nowDone) toast(randomHype());
            }}
          >
            {doneToday ? '✓ Warm-up Complete' : 'Mark Warm-up Complete'}
          </CompleteButton>
          <WeekStrip days={stripDays} label="Warm-up completion, last 7 days" />
        </Stack>
      </Card>

      {plan.sections.map((section) => (
        <Card key={section.id}>
          <CardTitle>{section.title}</CardTitle>
          <Muted>{section.subtitle}</Muted>
          {section.items.map((item) => {
            const isTicked = ticked.has(item.key);
            const Icon = isTicked ? CircleCheck : Circle;
            return (
              <ItemButton
                key={item.key}
                type="button"
                ticked={isTicked}
                aria-pressed={isTicked}
                onClick={() => toggleItem(item)}
              >
                <Icon size={20} aria-hidden="true" />
                <ItemName>{item.name}</ItemName>
                <ItemDetail>{item.detail}</ItemDetail>
                <SrOnly>{isTicked ? 'done' : 'not done yet'}</SrOnly>
              </ItemButton>
            );
          })}
        </Card>
      ))}

      <OtherRoutines>
        <summary>Other routines</summary>
        <Stack gap={3}>
          {otherFocuses.map((other) => {
            const block = WARMUP_BLOCKS[other];
            return (
              <div key={other}>
                <CardTitle as="h4">{WARMUP_FOCUS_LABEL[other]}</CardTitle>
                <Muted>{block.subtitle}</Muted>
                {[...block.items, ...(block.pinned ?? [])].map((item, i) => (
                  <SetRow key={item.name} noBorder={i === 0}>
                    <span>{item.name}</span>
                    <Muted as="span">{item.detail}</Muted>
                  </SetRow>
                ))}
              </div>
            );
          })}
        </Stack>
      </OtherRoutines>

      <Card>
        <Stack gap={2}>
          <CardTitle>{WARMUP_WHY.title}</CardTitle>
          <Muted>{WARMUP_WHY.text}</Muted>
        </Stack>
      </Card>
    </Stack>
  );
}
