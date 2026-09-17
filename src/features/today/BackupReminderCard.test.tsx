import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { STORAGE_KEYS, fullKey } from '@/lib/storage';
import { BACKUP_NUDGE_DAYS, isoDate } from '@/lib/domain';
import { BackupReminderCard } from './BackupReminderCard';

/** downloadBackup drives a real anchor click; stub it and assert it was called. */
const downloadBackup = vi.hoisted(() => vi.fn());
vi.mock('@/features/more/backup', () => ({ downloadBackup }));

/** Writes the key as if a backup happened `days` ago. */
function backedUpDaysAgo(days: number) {
  const when = new Date();
  when.setDate(when.getDate() - days);
  localStorage.setItem(fullKey(STORAGE_KEYS.lastBackupAt), isoDate(when));
}

const card = () => screen.queryByText(/No backup yet|Last backup was/);

beforeEach(() => {
  localStorage.clear();
  downloadBackup.mockReset();
});

/**
 * The half that closes gap #8: the same status exists in Settings, but inside a
 * collapsed accordion on a page that is rarely opened, so it is a status rather
 * than a reminder. This one has to appear unprompted, and only when it matters.
 */
describe('BackupReminderCard', () => {
  it('shows when this device has never exported', () => {
    renderWithTheme(<BackupReminderCard />);
    expect(card()).toHaveTextContent('No backup yet');
  });

  it('shows the age once past the threshold', () => {
    backedUpDaysAgo(BACKUP_NUDGE_DAYS + 6);
    renderWithTheme(<BackupReminderCard />);
    expect(card()).toHaveTextContent(`Last backup was ${BACKUP_NUDGE_DAYS + 6} days ago`);
  });

  /** Today is the home screen; a standing reassurance trains you to skip it. */
  it('renders nothing while the backup is fresh', () => {
    backedUpDaysAgo(1);
    renderWithTheme(<BackupReminderCard />);
    expect(card()).toBeNull();
  });

  it('stays visible right up to the threshold', () => {
    backedUpDaysAgo(BACKUP_NUDGE_DAYS - 1);
    renderWithTheme(<BackupReminderCard />);
    expect(card()).toBeNull();
  });

  it('exports in place and dismisses itself once the date is recorded', () => {
    renderWithTheme(<BackupReminderCard />);
    // downloadBackup is stubbed, so stand in for its side effect.
    downloadBackup.mockImplementation(() => backedUpDaysAgo(0));

    fireEvent.click(screen.getByRole('button', { name: /export a backup now/i }));

    expect(downloadBackup).toHaveBeenCalledTimes(1);
    expect(card()).toBeNull();
  });

  /** A failed write must leave the card up rather than silently clearing it. */
  it('stays up if the export did not record a date', () => {
    renderWithTheme(<BackupReminderCard />);
    downloadBackup.mockImplementation(() => {}); // wrote nothing

    fireEvent.click(screen.getByRole('button', { name: /export a backup now/i }));

    expect(card()).toHaveTextContent('No backup yet');
  });
});
