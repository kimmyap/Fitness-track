/**
 * "Saved Xs ago" indicator + dismissible sync-warning banner, wired to the
 * storage layer's save-status subscription (legacy gt-last-saved /
 * gt-sync-warning).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import styled from '@emotion/styled';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components';
import { clearSyncFailedFlag, getSaveStatus, subscribeSaveStatus, type SaveStatus } from '@/lib/storage';

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
}

/** Legacy label: <5s "Saved just now", <60s "Saved Ns ago", else "Saved Nm ago". */
export function savedAgoLabel(lastSavedAt: Date, now: Date = new Date()): string {
  const secsAgo = Math.floor((now.getTime() - lastSavedAt.getTime()) / 1000);
  if (secsAgo < 5) return 'Saved just now';
  if (secsAgo < 60) return `Saved ${secsAgo}s ago`;
  return `Saved ${Math.floor(secsAgo / 60)}m ago`;
}

const IndicatorWrap = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.accent};
  flex-shrink: 0;
`;

/** Renders nothing until the first successful save this session (legacy). */
export function SaveStatusIndicator() {
  const { lastSavedAt } = useSaveStatus();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (!lastSavedAt) return null;
  return (
    <IndicatorWrap>
      <Dot aria-hidden="true" />
      {savedAgoLabel(lastSavedAt, now)}
    </IndicatorWrap>
  );
}

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  border: 1px solid ${({ theme }) => theme.colors.destructive};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

const BannerIcon = styled(TriangleAlert)`
  color: ${({ theme }) => theme.colors.destructiveText};
  flex-shrink: 0;
`;

const BannerText = styled.span`
  flex: 1;
`;

/** Dismissible warning shown after a save failed (a backup auto-downloaded). */
export function SyncWarningBanner() {
  const { pendingSyncFailed } = useSaveStatus();
  if (!pendingSyncFailed) return null;
  return (
    <Banner role="alert">
      <BannerIcon size={18} aria-hidden="true" />
      <BannerText>Storage had trouble saving recently. A backup auto-downloaded, check your downloads.</BannerText>
      <Button type="button" variant="ghost" onClick={clearSyncFailedFlag}>
        Dismiss
      </Button>
    </Banner>
  );
}
