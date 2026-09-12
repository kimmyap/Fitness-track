import { Fragment } from 'react';
import styled from '@emotion/styled';
import { Trash2, Undo2, X } from 'lucide-react';
import { IconButton } from './IconButton';

/** Confirm reads as a word, not just a red icon — colour never carries meaning alone. */
const ConfirmText = styled.span`
  margin-left: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 700;
`;

export interface ConfirmDeleteActionProps {
  /**
   * Noun phrase naming what would be deleted, e.g. "this set (135lbs x 8)".
   * Builds all three accessible names, so it must read correctly after
   * "Delete ", "Confirm delete of " and "Keep ".
   */
  target: string;
  armed: boolean;
  onArm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  iconSize?: number;
  /**
   * Word shown beside the X before arming. Omit inside a dense row where only
   * the icon fits; pass it where there is room, so delete reads like the
   * labelled actions beside it.
   */
  idleLabel?: string;
}

/**
 * Row-level delete gate: the first tap arms, and confirm/cancel then replace
 * the X in place.
 *
 * Deliberately NOT `ConfirmTap`. That one re-uses the same button for the
 * confirm, which is right for a full-width deliberate action (reset all data)
 * but wrong here — the mis-tap this guards against is a second tap in the same
 * spot, so cancel takes the X's position and confirm sits to its left. There is
 * no auto-disarm timer either: a row stays armed until answered.
 *
 * `armed` is controlled so the list owning the rows can keep a single armed id
 * and disarm any other row for free.
 */
export function ConfirmDeleteAction({
  target,
  armed,
  onArm,
  onCancel,
  onConfirm,
  iconSize = 16,
  idleLabel,
}: ConfirmDeleteActionProps) {
  if (!armed) {
    return (
      <IconButton aria-label={`Delete ${target}`} tone="destructive" onClick={onArm}>
        <X size={iconSize} aria-hidden="true" />
        {idleLabel ? <ConfirmText>{idleLabel}</ConfirmText> : null}
      </IconButton>
    );
  }

  return (
    <Fragment>
      <IconButton aria-label={`Confirm delete of ${target}`} tone="destructive" onClick={onConfirm}>
        <Trash2 size={iconSize} aria-hidden="true" />
        <ConfirmText>Delete?</ConfirmText>
      </IconButton>
      <IconButton aria-label={`Keep ${target}`} onClick={onCancel}>
        <Undo2 size={iconSize} aria-hidden="true" />
      </IconButton>
    </Fragment>
  );
}
