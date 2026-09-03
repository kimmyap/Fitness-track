import { useEffect, useId, useRef } from 'react';
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[4]};
  z-index: 100;
`;

const Panel = styled.div`
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.space[5]};
  width: 100%;
  max-width: 420px;
  max-height: 85dvh;
  overflow-y: auto;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

const Title = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 700;
`;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Centered dialog with focus trap, Esc-to-close and focus restore. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Callers commonly pass an inline arrow for onClose, so its identity changes
  // on every parent render. Reading it through a ref keeps the focus effect
  // below keyed on `open` alone — otherwise each keystroke inside the dialog
  // re-ran the trap, blurring the focused input and dismissing the mobile
  // keyboard.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusables.length) return;
      const firstEl = focusables[0] as HTMLElement;
      const lastEl = focusables[focusables.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <Overlay
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Panel ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <Head>
          <Title id={titleId}>{title}</Title>
          <IconButton aria-label="Close dialog" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </Head>
        {children}
      </Panel>
    </Overlay>
  );
}
