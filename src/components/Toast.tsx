/**
 * Toast system with optional Undo action (legacy: 5s auto-dismiss).
 * Usage: call `toast("Entry deleted", { undo: () => ... })` anywhere;
 * mount `<Toaster />` once (AppLayout does this).
 */
import { create } from 'zustand';
import styled from '@emotion/styled';
import { Button } from './Button';

export const TOAST_DURATION_MS = 5000;

export interface ToastItem {
  id: number;
  message: string;
  undo?: () => void;
  undoLabel?: string;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, opts?: { undo?: () => void; undoLabel?: string; durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, opts) => {
    const id = nextId++;
    const item: ToastItem = { id, message };
    if (opts?.undo) {
      item.undo = opts.undo;
      item.undoLabel = opts.undoLabel ?? 'Undo';
    }
    set({ toasts: [...get().toasts, item] });
    setTimeout(() => get().dismiss(id), opts?.durationMs ?? TOAST_DURATION_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Imperative helper for non-component code. */
export function toast(message: string, opts?: { undo?: () => void; undoLabel?: string; durationMs?: number }): void {
  useToastStore.getState().show(message, opts);
}

const Region = styled.div`
  position: fixed;
  bottom: calc(${({ theme }) => theme.space[5]} + env(safe-area-inset-bottom, 0px) + 64px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  z-index: 200;
  width: min(92vw, 420px);
  pointer-events: none;
`;

const ToastCard = styled.div`
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.foreground};
  color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  box-shadow: 0 4px 16px ${({ theme }) => theme.colors.overlay};
`;

const UndoButton = styled(Button)`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  font-weight: 700;
`;

/** aria-live="polite": announced without stealing focus. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <Region aria-live="polite" role="status">
      {toasts.map((t) => (
        <ToastCard key={t.id}>
          <span>{t.message}</span>
          {t.undo ? (
            <UndoButton
              variant="ghost"
              onClick={() => {
                t.undo?.();
                dismiss(t.id);
              }}
            >
              {t.undoLabel}
            </UndoButton>
          ) : null}
        </ToastCard>
      ))}
    </Region>
  );
}
