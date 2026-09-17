/**
 * Backup staleness nudge: shows only once the last export is ≥14 days old, or
 * has never happened. Exports in place rather than sending you to Settings.
 *
 * On Today because a nudge nobody sees is not a nudge. The same status also
 * lives in Settings → Data, but that is inside a COLLAPSED accordion on a page
 * you rarely open, which makes it a status you can look up, not a reminder that
 * reaches you. This is the half that closes docs/HANDOFF.md gap #8.
 *
 * Returns null when the backup is fresh, exactly like ProgramReviewCard: Today
 * is the home screen and a permanently present reassurance would be clutter
 * that trains you to skip the card when it does have something to say.
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { ShieldAlert } from 'lucide-react';
import { Button, Card, toast } from '@/components';
import { backupIsStale, daysSinceBackup } from '@/lib/domain';
import { getLastBackupAt } from '@/lib/storage';
import { downloadBackup } from '@/features/more/backup';
import { CardTitle, Muted, Stack } from '@/features/train/ui';

/** Destructive, not primary: this one is about losing everything. */
const NudgeCard = styled(Card)`
  border-color: ${({ theme }) => theme.colors.destructive};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.destructiveText};
`;

export function BackupReminderCard() {
  const [days, setDays] = useState<number | null>(() => daysSinceBackup(getLastBackupAt()));
  if (!backupIsStale(days)) return null;

  const title = days === null ? 'No backup yet' : `Last backup was ${days} days ago`;

  return (
    <NudgeCard>
      <Stack gap={2}>
        <TitleRow>
          <ShieldAlert size={18} aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </TitleRow>
        <Muted>
          Your whole history lives in this browser on this phone. Clearing site data, or losing the
          phone, loses all of it. The file downloads to your phone — keep it somewhere that syncs.
        </Muted>
        <Button
          fullWidth
          onClick={() => {
            downloadBackup();
            /*
             * Re-read rather than assume: downloadBackup owns the write, so if
             * it failed the card must stay up. It disappears on the next render
             * only because the value really changed.
             */
            setDays(daysSinceBackup(getLastBackupAt()));
            toast('Backup downloaded — check your Files app');
          }}
        >
          Export a backup now
        </Button>
      </Stack>
    </NudgeCard>
  );
}
