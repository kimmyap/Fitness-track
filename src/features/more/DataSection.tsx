/**
 * Settings — Data: where-your-data-lives warning, export backup, import
 * backup (merge-by-id with the legacy "would lose N sets" second-tap gate),
 * and reset all logged data (two-tap confirm, clears entries only).
 */
import { useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Button, ConfirmTap, toast } from '@/components';
import { useEntriesStore } from '@/stores';
import { analyzeImport, applyImport, downloadBackup, parseBackup, type IncomingBackup } from './backup';
import { SaveStatusIndicator } from './SaveStatus';

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const StrongNote = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.destructive};
`;

const PendingNote = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.destructive};
`;

interface PendingImport {
  payload: IncomingBackup;
  missing: number;
}

const IMPORT_ERROR_MSG = "Couldn't read that file, make sure it's a Gym Log backup JSON";

export function DataSection() {
  const resetAll = useEntriesStore((s) => s.resetAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const runImport = (payload: IncomingBackup) => {
    try {
      applyImport(payload);
      toast('Backup merged in successfully');
    } catch {
      toast(IMPORT_ERROR_MSG);
    }
  };

  const onFileChosen = async (file: File) => {
    try {
      const payload = parseBackup(await file.text());
      const missing = analyzeImport(payload);
      if (missing > 0) {
        // Legacy gate: warn and require a second Import tap. Nothing is ever
        // deleted — the merge only adds — but the file is older/partial.
        setPendingImport({ payload, missing });
        toast(
          `This file is missing ${missing} set(s) you currently have logged. Tap Import again to merge anyway (nothing gets deleted, just merged together).`,
          { durationMs: 8000 },
        );
        return;
      }
      runImport(payload);
    } catch {
      toast(IMPORT_ERROR_MSG);
    }
  };

  const onImportClick = () => {
    if (pendingImport) {
      runImport(pendingImport.payload);
      setPendingImport(null);
      return;
    }
    fileRef.current?.click();
  };

  return (
    <>
      <Note>
        Everything is saved only in this browser, on this device. It&apos;s not backed up to any account
        automatically.
      </Note>
      <StrongNote>
        Clearing this browser&apos;s site data, or using a different device/browser, will NOT show your history.
        Export a backup regularly to be safe.
      </StrongNote>

      <Button type="button" variant="secondary" fullWidth onClick={() => downloadBackup()}>
        Export backup (JSON)
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFileChosen(file);
          e.target.value = '';
        }}
      />
      <Button type="button" variant="secondary" fullWidth onClick={onImportClick}>
        {pendingImport ? 'Import again to confirm merge' : 'Import backup (JSON)'}
      </Button>
      {pendingImport ? (
        <PendingNote aria-live="polite">
          This file is missing {pendingImport.missing} set(s) you have logged. Importing merges — nothing gets
          deleted.
        </PendingNote>
      ) : null}

      <ConfirmTap confirmLabel="Tap again to confirm reset" fullWidth onConfirm={resetAll}>
        Reset all logged data
      </ConfirmTap>
      <Note>Reset clears logged entries only — settings, goals and bodyweight stay.</Note>

      <SaveStatusIndicator />
    </>
  );
}
