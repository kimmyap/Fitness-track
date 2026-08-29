/**
 * Core tab (legacy renderCore): mark-complete toggle + 7-day WeekStrip +
 * "The Finisher" list with the alternative-swap flow (coreOverrides store,
 * revert option).
 */
import { useState } from 'react';
import { Badge, Button, Card, Confetti, WeekStrip, toast } from '@/components';
import { useEntriesStore, useCoreOverridesStore, useAchievementsStore } from '@/stores';
import { isoDate } from '@/lib/domain';
import { CORE_ALTERNATIVES, CORE_EXERCISES, randomHype } from '@/lib/program';
import type { CoreAlternative } from '@/lib/program';
import { celebrateAchievements, useConfetti } from '@/features/today/celebrate';
import { CardTitle, Muted, SetRow, Stack, TextButton, last7Dates } from './ui';
import { CompleteButton } from './WarmupTab';

export function CoreTab() {
  const todayIso = isoDate();
  const entries = useEntriesStore((s) => s.entries);
  const toggleCompletion = useEntriesStore((s) => s.toggleCompletion);
  // Raw subscription + pure derivation (zustand v5: no fresh-array selectors)
  const coreOverrides = useCoreOverridesStore((s) => s.coreOverrides);
  const slots = CORE_EXERCISES.map((original) => {
    const override = coreOverrides[original.name];
    return { original, effective: override ?? original, swapped: Boolean(override) };
  });
  const setOverride = useCoreOverridesStore((s) => s.setOverride);
  const revertOverride = useCoreOverridesStore((s) => s.revertOverride);
  const confetti = useConfetti();

  /** Per-slot random suggestion awaiting confirmation. */
  const [picks, setPicks] = useState<Record<string, CoreAlternative>>({});

  const doneToday = entries.some((e) => 'type' in e && e.type === 'core' && e.date === todayIso);
  const stripDays = last7Dates().map((date) => ({
    date,
    done: entries.some((e) => 'type' in e && e.type === 'core' && e.date === date),
  }));

  const handleToggle = () => {
    const nowDone = toggleCompletion('core', todayIso);
    if (nowDone) {
      toast(randomHype());
      celebrateAchievements(useAchievementsStore.getState().checkAchievements(), confetti.fire);
    }
  };

  return (
    <Stack gap={3}>
      <Card>
        <Stack gap={2}>
          <CardTitle>
            Today&apos;s Core Finisher <Badge>optional</Badge>
          </CardTitle>
          <Muted>{doneToday ? 'Marked complete' : 'Not logged yet'}</Muted>
          <CompleteButton fullWidth done={doneToday} onClick={handleToggle}>
            {doneToday ? '✓ Core Complete' : 'Mark Core Complete'}
          </CompleteButton>
          <WeekStrip days={stripDays} label="Core finisher completion, last 7 days" />
        </Stack>
      </Card>

      <Card>
        <CardTitle>The Finisher</CardTitle>
        {slots.map(({ original, effective, swapped }) => {
          const options = CORE_ALTERNATIVES[original.name];
          const pick = picks[original.name];
          return (
            <div key={original.name}>
              <SetRow>
                <span>
                  {effective.name} {swapped ? <Badge>swapped from {original.name}</Badge> : null}
                </span>
                <Muted as="span">{effective.target}</Muted>
              </SetRow>
              {options && options.length ? (
                swapped ? (
                  <TextButton
                    onClick={() => {
                      revertOverride(original.name);
                      setPicks((p) => {
                        const next = { ...p };
                        delete next[original.name];
                        return next;
                      });
                    }}
                  >
                    Revert to {original.name}
                  </TextButton>
                ) : (
                  <>
                    <TextButton
                      onClick={() => {
                        const next = options[Math.floor(Math.random() * options.length)] as CoreAlternative;
                        setPicks((p) => ({ ...p, [original.name]: next }));
                      }}
                    >
                      {pick ? `Try: ${pick.name} — ${pick.reason}` : `Suggest an alternative to ${original.name}`}
                    </TextButton>
                    {pick ? (
                      <Button
                        fullWidth
                        onClick={() => {
                          setOverride(original.name, { name: pick.name, target: pick.target });
                          toast(`${pick.name} swapped in for ${original.name}`);
                          setPicks((p) => {
                            const next = { ...p };
                            delete next[original.name];
                            return next;
                          });
                        }}
                      >
                        Swap in {pick.name}
                      </Button>
                    ) : null}
                  </>
                )
              ) : null}
            </div>
          );
        })}
      </Card>

      <Card>
        <Stack gap={2}>
          <CardTitle>When to use this</CardTitle>
          <Muted>
            Good for days you finish your lift and warm-up with energy left over. Keeps things low-stakes, no
            weight, nothing that needs its own recovery day.
          </Muted>
        </Stack>
      </Card>

      <Confetti active={confetti.active} onDone={confetti.done} />
    </Stack>
  );
}
