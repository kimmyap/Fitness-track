import { useId, type KeyboardEvent, type ReactNode } from 'react';
import styled from '@emotion/styled';

/** Props the caller must spread onto its own trigger element. */
export interface RowMenuTriggerProps {
  type: 'button';
  id: string;
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
}

export interface RowMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Names the action group for screen readers, e.g. "Set 1, 135lbs x 8". */
  label: string;
  /** Buttons revealed while open. */
  actions: ReactNode;
  children: (trigger: RowMenuTriggerProps) => ReactNode;
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const Strip = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => `0 ${theme.space[2]} ${theme.space[2]}`};
`;

/** Label beside an action's icon — the strip is roomier than a row, so spell them out. */
export const RowMenuLabel = styled.span`
  margin-left: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 600;
`;

/**
 * A list row that opens its own actions instead of carrying them inline.
 *
 * Rows used to hold three icon buttons each, which made a dense list of small
 * targets sitting where a thumb scrolls. Here the row IS the target and the
 * actions appear beneath it, so nothing destructive is one stray tap away.
 *
 * Disclosure, not a floating menu: an inline strip needs no portal, no
 * positioning against a scrolling card, and no focus trap, and it cannot be
 * clipped by the card it lives in. The trigger is rendered by the caller — the
 * two lists that use this style their rows differently — so this owns only the
 * wiring: the aria pair, Escape to close, and the strip itself.
 *
 * `open` is controlled so the list can keep a single open id and close any
 * other row for free.
 */
export function RowMenu({ open, onToggle, onClose, label, actions, children }: RowMenuProps) {
  const triggerId = useId();
  const panelId = useId();

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      onClose();
      document.getElementById(triggerId)?.focus();
    }
  };

  return (
    <Wrapper onKeyDown={handleKeyDown}>
      {children({
        type: 'button',
        id: triggerId,
        'aria-expanded': open,
        'aria-controls': panelId,
        onClick: onToggle,
      })}
      {open ? (
        <Strip id={panelId} role="group" aria-label={`Actions for ${label}`}>
          {actions}
        </Strip>
      ) : null}
    </Wrapper>
  );
}
