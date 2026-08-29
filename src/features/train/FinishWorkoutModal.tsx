/**
 * Finish Workout summary modal (legacy showWorkoutSummary): sets, volume,
 * PRs today, exercise + warm-up counts, core/activity done, random hype
 * line, confetti when a PR happened. Always summarizes TODAY (legacy quirk,
 * even when backdating logs).
 */
import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Button, Modal, StatStrip, StatTile } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { bestFor, entryVolume, isoDate } from '@/lib/domain';
import { isLiftSet } from '@/lib/types';
import type { ActivityEntry, LiftSetEntry } from '@/lib/types';
import { randomHype } from '@/lib/program';
import { Muted, Stack, fmtVolume, unitLabel } from './ui';

const HypeLine = styled.p`
  margin: 0;
  text-align: center;
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const CenteredMuted = styled(Muted)`
  text-align: center;
`;

export interface FinishWorkoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfetti: () => void;
}

export function FinishWorkoutModal({ open, onClose, onConfetti }: FinishWorkoutModalProps) {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const [hype, setHype] = useState('');

  const todayIso = isoDate();
  const todayLifts = entries.filter((e): e is LiftSetEntry => isLiftSet(e) && e.date === todayIso && !e.warmupSet);
  const totalSets = todayLifts.length;
  const totalVolume = todayLifts
    .filter((e) => !e.assistedPullup && e.weight)
    .reduce((sum, e) => sum + entryVolume(e), 0);
  const exNames = [...new Set(todayLifts.map((e) => e.exercise))];
  let prCount = 0;
  exNames.forEach((name) => {
    const best = bestFor(entries, name);
    if (best && best.date === todayIso) prCount++;
  });
  const warmupCount = entries.filter((e) => isLiftSet(e) && e.date === todayIso && e.warmupSet).length;
  const doneActivity = entries
    .filter((e): e is ActivityEntry => 'type' in e && e.type === 'activity' && e.date === todayIso)
    .map((e) => e.activity);
  const doneCore = entries.some((e) => 'type' in e && e.type === 'core' && e.date === todayIso);

  useEffect(() => {
    if (open) setHype(randomHype());
  }, [open]);

  useEffect(() => {
    if (open && prCount > 0) onConfetti();
  }, [open, prCount, onConfetti]);

  const summaryBits = [
    `${exNames.length} exercise${exNames.length !== 1 ? 's' : ''}`,
    warmupCount ? `${warmupCount} warm-up set${warmupCount !== 1 ? 's' : ''}` : null,
    doneCore ? 'Core done' : null,
    doneActivity.length ? doneActivity.join(', ') : null,
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title={prCount > 0 ? 'Great Session!' : 'Workout Complete'}>
      <Stack gap={4}>
        <StatStrip>
          <StatTile label="Sets" value={totalSets} />
          <StatTile label={`${unitLabel(unit)} Volume`} value={fmtVolume(totalVolume, unit)} />
          <StatTile label="PRs Today" value={prCount} />
        </StatStrip>
        <CenteredMuted>{summaryBits.join(' · ')}</CenteredMuted>
        <HypeLine>{hype}</HypeLine>
        <Button fullWidth onClick={onClose}>
          Nice
        </Button>
      </Stack>
    </Modal>
  );
}
